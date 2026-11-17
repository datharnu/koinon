import {
  ACCOUNT_PATH,
  KoinonError,
  accountFromMnemonic,
  bitcoinNetwork,
  createFundPsbt,
  finalizeFundPsbt,
  mnemonicFromEntropy,
  p2wpkhAddress,
  psbtFromBase64,
  pubkeyAt,
  satsForXof,
  signFundPsbt,
  verifySpend,
  type PolicyKeys,
  type Role,
} from "@koinon/core";
import { createIdentity, decideSpend, openPool, publishMessage, readMessages, type KoinonMessage, type ParsedMessage } from "@koinon/nostr";
import { Psbt } from "bitcoinjs-lib";
import { api, coordinatorUrl, endpoints, KoinonApiError, type RequestView } from "./api";
import { rememberRequest, storeSecret, writeConfig, type FundConfig, type Secret } from "./vault";

export type OfficerRole = "O1" | "O2" | "O3";

export const DEMO_MEMBERS = [
  "Awa", "Moussa", "Fatou", "Ibrahima", "Aminata", "Cheikh",
  "Mariama", "Ousmane", "Khady", "Mamadou", "Ndèye", "Abdoulaye",
] as const;

export const DEMO_DUES_XOF = 5000n;

export function relayUrl(): string {
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${window.location.host}/relay`;
}

export function policyKeys(config: FundConfig): PolicyKeys {
  const officer = (role: OfficerRole) => ({ role, xpub: config.officers[role].xpub, path: ACCOUNT_PATH }) as const;
  return {
    officers: [officer("O1"), officer("O2"), officer("O3")],
    assembly: { role: "K", xpub: config.assembly.xpub, path: ACCOUNT_PATH },
    csvBlocks: config.csvBlocks,
  };
}

export type SetupStep = "keys" | "register" | "members" | "dues" | "done";

/**
 * Creates every key in this browser, registers only the public keys, adds the members,
 * and pays each member's dues from the regtest faucet.
 */
export async function createDemoFund(args: {
  name: string;
  pin: string;
  labels: Record<Role, string>;
  onStep: (step: SetupStep, done: number, total: number) => void;
}): Promise<FundConfig> {
  args.onStep("keys", 0, 4);
  const made = {} as Record<Role, { xpub: string; nostrPub: string }>;
  for (const [position, role] of (["O1", "O2", "O3", "K"] as const).entries()) {
    const mnemonic = mnemonicFromEntropy(crypto.getRandomValues(new Uint8Array(16)));
    const account = accountFromMnemonic(mnemonic, role, "regtest");
    const nostr = createIdentity();
    await storeSecret(role, { mnemonic, nostrSecret: nostr.secretKey }, args.pin);
    made[role] = { xpub: account.xpub, nostrPub: nostr.publicKey };
    args.onStep("keys", position + 1, 4);
  }

  args.onStep("register", 0, 1);
  const created = await api<{ id: string }>("POST", "/v1/funds", {
    name: args.name,
    csv_blocks: 10,
    fee_cap_sats: "100000",
    officers: (["O1", "O2", "O3"] as const).map((role) => ({ role, label: args.labels[role], xpub: made[role].xpub })),
    assembly: { label: args.labels.K, xpub: made.K.xpub },
  });
  const config: FundConfig = {
    v: 1,
    fundId: created.id,
    name: args.name,
    csvBlocks: 10,
    feeCapSats: "100000",
    officers: {
      O1: { label: args.labels.O1, ...made.O1 },
      O2: { label: args.labels.O2, ...made.O2 },
      O3: { label: args.labels.O3, ...made.O3 },
    },
    assembly: { label: args.labels.K, ...made.K },
    vendorAddress: vendorAddress(),
    createdAt: new Date().toISOString(),
  };
  writeConfig(config);
  args.onStep("register", 1, 1);

  const addresses: string[] = [];
  for (const [position, pseudonym] of DEMO_MEMBERS.entries()) {
    const member = await api<{ address: string }>("POST", `/v1/funds/${created.id}/members`, { pseudonym });
    addresses.push(member.address);
    args.onStep("members", position + 1, DEMO_MEMBERS.length);
  }

  const rate = await endpoints.rate();
  if (!rate.btc_eur) throw new KoinonApiError("RATE_UNAVAILABLE", "no rate", 503);
  const sats = satsForXof(DEMO_DUES_XOF, rate.btc_eur);
  for (const [position, address] of addresses.entries()) {
    await api("POST", "/v1/demo/faucet", { address, sats: sats.toString() });
    args.onStep("dues", position + 1, addresses.length);
  }
  args.onStep("done", 1, 1);
  return config;
}

/** The demo vendor's address, from a throwaway key nobody keeps. */
function vendorAddress(): string {
  const mnemonic = mnemonicFromEntropy(crypto.getRandomValues(new Uint8Array(16)));
  const account = accountFromMnemonic(mnemonic, "O1", "regtest");
  return p2wpkhAddress(pubkeyAt(account.xpub, 0, 0, "regtest"), "regtest");
}

export async function payDues(config: FundConfig, memberIndex: number, xof: bigint): Promise<string> {
  const { members } = await endpoints.members(config.fundId);
  const member = members.find((item) => item.index === memberIndex);
  if (!member) throw new KoinonApiError("NOT_FOUND", "member", 404);
  const rate = await endpoints.rate();
  if (!rate.btc_eur) throw new KoinonApiError("RATE_UNAVAILABLE", "no rate", 503);
  const sats = satsForXof(xof, rate.btc_eur);
  const paid = await api<{ txid: string }>("POST", "/v1/demo/faucet", { address: member.address, sats: sats.toString() });
  return paid.txid;
}

export async function mine(blocks: number): Promise<number> {
  const mined = await api<{ height: number }>("POST", "/v1/demo/mine", { blocks });
  return mined.height;
}

async function memberIndexes(fundId: string): Promise<number[]> {
  const { members } = await endpoints.members(fundId);
  return members.map((member) => member.index);
}

async function send(sender: Uint8Array, recipients: string[], message: KoinonMessage): Promise<void> {
  const pool = openPool();
  try {
    for (const recipientPublicKey of recipients) {
      await publishMessage({ pool, relayUrl: relayUrl(), sender, recipientPublicKey, message });
    }
  } finally {
    pool.destroy();
  }
}

export async function inbox(secret: Secret, publicKey: string): Promise<ParsedMessage[]> {
  const pool = openPool();
  try {
    return await readMessages({ pool, relayUrl: relayUrl(), recipient: { secretKey: secret.nostrSecret, publicKey }, maxWaitMs: 2_500 });
  } finally {
    pool.destroy();
  }
}

function others(role: OfficerRole): OfficerRole[] {
  return (["O1", "O2", "O3"] as const).filter((item) => item !== role);
}

/**
 * Opens a spend, gift-wraps it to the other two officers, then signs it as the requester
 * after running the same signer check every officer runs.
 */
export async function openSpend(args: {
  config: FundConfig;
  role: OfficerRole;
  secret: Secret;
  amountXof: number;
  recipient: string;
  purpose: string;
}): Promise<RequestView> {
  const created = await api<RequestView>(
    "POST",
    `/v1/funds/${args.config.fundId}/requests`,
    { role: args.role, recipient: args.recipient, purpose: args.purpose, amount_xof: args.amountXof, path: "A" },
    { role: args.role, mnemonic: args.secret.mnemonic },
  );
  rememberRequest(args.role, created.id);
  await send(
    args.secret.nostrSecret,
    others(args.role).map((item) => args.config.officers[item].nostrPub),
    {
      type: "koinon.spend_request.v1",
      request_id: created.id,
      fund_id: args.config.fundId,
      amount_xof: Number(created.amount_xof),
      amount_sats: created.amount_sats,
      recipient: args.recipient,
      purpose: args.purpose,
      expires_at: created.expires_at,
      coordinator_url: coordinatorUrl(),
      path: "A",
    },
  );
  return created;
}

export type Decision =
  | { kind: "signed"; status: string }
  | { kind: "refused"; code: string }
  | { kind: "ignored"; reason: string };

/** The fields the officer reads come from the message (or, for the requester, from what they typed). */
export async function signSpend(args: {
  config: FundConfig;
  role: OfficerRole;
  secret: Secret;
  read: { request_id: string; amount_xof: number; amount_sats: string; recipient: string; purpose: string; expires_at: string; path: "A" | "B" };
  requester: Role;
  tamper?: boolean;
}): Promise<Decision> {
  const decision = await decideSpend({
    message: { type: "koinon.spend_request.v1", fund_id: args.config.fundId, coordinator_url: coordinatorUrl(), ...args.read },
    now: new Date(),
    coordinatorUrl: coordinatorUrl(),
    officer: args.role,
    mnemonic: args.secret.mnemonic,
    fund: {
      network: "regtest",
      keys: policyKeys(args.config),
      feeCap: BigInt(args.config.feeCapSats),
      memberIndexes: await memberIndexes(args.config.fundId),
    },
    loadPsbt: async (id) => {
      const request = await endpoints.request(id);
      return args.tamper ? swapRecipient(request.psbt) : request.psbt;
    },
  });
  if (decision.action === "ignored") return { kind: "ignored", reason: decision.reason };
  if (decision.action === "refused") return { kind: "refused", code: decision.code };
  const posted = await api<{ status: string }>(
    "POST",
    `/v1/requests/${args.read.request_id}/signatures`,
    { psbt: decision.signedPsbt },
    { role: args.role, mnemonic: args.secret.mnemonic },
  );
  if (args.requester !== args.role && args.requester !== "K") {
    await send(args.secret.nostrSecret, [args.config.officers[args.requester].nostrPub], decision.message);
  }
  return { kind: "signed", status: posted.status };
}

export async function rejectSpend(args: { config: FundConfig; role: OfficerRole; secret: Secret; requestId: string; requester: Role; reason: string }): Promise<void> {
  await api("POST", `/v1/requests/${args.requestId}/reject`, { reason: args.reason }, { role: args.role, mnemonic: args.secret.mnemonic });
  if (args.requester !== "K" && args.requester !== args.role) {
    await send(args.secret.nostrSecret, [args.config.officers[args.requester].nostrPub], {
      type: "koinon.spend_rejection.v1",
      request_id: args.requestId,
      fund_id: args.config.fundId,
      officer: args.role,
      reason: args.reason,
    });
  }
}

export async function broadcast(requestId: string): Promise<string> {
  const result = await api<{ txid: string }>("POST", `/v1/requests/${requestId}/broadcast`);
  return result.txid;
}

export type NodeAnswer = { kind: "accepted"; txid: string } | { kind: "refused"; message: string };

async function sendRaw(hex: string): Promise<NodeAnswer> {
  try {
    const { txid } = await api<{ txid: string }>("POST", "/v1/tx", { hex });
    return { kind: "accepted", txid };
  } catch (error) {
    if (error instanceof KoinonApiError && error.code === "NODE_REJECTED") return { kind: "refused", message: error.message };
    throw error;
  }
}

/** The treasurer signs alone and sends the transaction straight to bitcoind. */
export async function spendAlone(args: { config: FundConfig; role: OfficerRole; secret: Secret; request: RequestView }): Promise<NodeAnswer> {
  const keys = policyKeys(args.config);
  const psbt = psbtFromBase64(args.request.psbt, "regtest");
  const verified = verifySpend(psbt, {
    network: "regtest",
    keys,
    recipient: args.request.recipient,
    amount: BigInt(args.request.amount_sats),
    feeCap: BigInt(args.config.feeCapSats),
    memberIndexes: await memberIndexes(args.config.fundId),
    mode: "path-a",
  });
  const unsigned = psbt.data.inputs.some((input) => (input.partialSig ?? []).length === 0);
  if (unsigned) signFundPsbt({ psbt, mnemonic: args.secret.mnemonic, network: "regtest", inputs: verified.inputs });
  const hex = finalizeFundPsbt({ psbt, keys, network: "regtest", mode: "single-sig-attack", inputs: verified.inputs });
  return sendRaw(hex);
}

/**
 * Path B: one officer and the assembly key, after csvBlocks confirmations.
 * The client builds it locally so the officer sees bitcoind's own answer.
 */
export async function recoverOne(args: { config: FundConfig; officer: Secret; assembly: Secret }): Promise<NodeAnswer | { kind: "empty" }> {
  const { entries } = await endpoints.ledger(args.config.fundId);
  const keys = policyKeys(args.config);
  const destination = p2wpkhAddress(pubkeyAt(args.config.assembly.xpub, 0, 0, "regtest"), "regtest");
  const coins = entries.filter((entry) => entry.kind === "contribution" && entry.vout !== null && entry.index !== null);
  // Youngest coin first: that is the one the timelock still holds.
  for (const coin of [...coins].sort((a, b) => a.confirmations - b.confirmations)) {
    const value = BigInt(coin.sats);
    const pay = value - 1_000n;
    if (pay < 546n) continue;
    const input = { txid: coin.txid, vout: coin.vout ?? 0, value, change: 0 as const, index: coin.index ?? 0 };
    const psbt = createFundPsbt({ network: "regtest", keys, inputs: [input], outputs: [{ address: destination, value: pay }], mode: "path-b" });
    signFundPsbt({ psbt, mnemonic: args.officer.mnemonic, network: "regtest", inputs: [input] });
    signFundPsbt({ psbt, mnemonic: args.assembly.mnemonic, network: "regtest", inputs: [input] });
    const hex = finalizeFundPsbt({ psbt, keys, network: "regtest", mode: "path-b", inputs: [input] });
    const answer = await sendRaw(hex);
    if (answer.kind === "refused" && /missingorspent|already in block chain|txn-mempool-conflict/i.test(answer.message)) continue;
    return answer;
  }
  return { kind: "empty" };
}

/** What a malicious coordinator would do: flip one byte of the recipient script. */
function swapRecipient(base64: string): string {
  const original = psbtFromBase64(base64, "regtest");
  const fresh = new Psbt({ network: bitcoinNetwork("regtest") });
  fresh.setMaximumFeeRate(100_000);
  const output = original.txOutputs[0];
  if (!output) throw new KoinonError("VALIDATION", "missing output");
  const script = new Uint8Array(output.script);
  script[script.length - 1] = (script[script.length - 1] ?? 0) ^ 1;
  original.txInputs.forEach((input, index) => {
    const data = original.data.inputs[index];
    if (!data?.witnessUtxo || !data.witnessScript) throw new KoinonError("VALIDATION", "incomplete psbt");
    fresh.addInput({ hash: input.hash, index: input.index, sequence: input.sequence, witnessUtxo: data.witnessUtxo, witnessScript: data.witnessScript });
  });
  original.txOutputs.forEach((item, index) => {
    fresh.addOutput({ script: index === 0 ? script : item.script, value: item.value });
  });
  return fresh.toBase64();
}

export function errorCode(error: unknown): string {
  if (error instanceof KoinonApiError) return error.code;
  if (error instanceof KoinonError) return error.code;
  if (error instanceof Error && error.message === "NO_KEY") return "NO_KEY";
  if (error instanceof Error && /wrong pin/i.test(error.message)) return "WRONG_PIN";
  return "UNKNOWN";
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
