import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Psbt } from "bitcoinjs-lib";
import {
  ACCOUNT_PATH,
  accountFromMnemonic,
  bitcoinNetwork,
  createFundPsbt,
  encryptKey,
  finalizeFundPsbt,
  KoinonError,
  mnemonicFromEntropy,
  psbtFromBase64,
  satsForXof,
  signFundPsbt,
  verifySpend,
  type PolicyKeys,
  type Role,
} from "@koinon/core";
import { createIdentity, decideSpend, openPool, publishMessage } from "@koinon/nostr";
import { api, btcFromSats, openKey, rpc, type Runtime } from "./api.js";
import { homeDir, keyPath, readConfig, writeConfig, type FundConfig } from "./config.js";
import { line } from "./text.js";

const LABELS = {
  O1: "Trésorier",
  O2: "Secrétaire",
  O3: "Président",
  K: "Assemblée",
} as const;

export async function initFund(ctx: Runtime, flags: Record<string, string>): Promise<void> {
  const pin = ctx.pin;
  if (!pin || pin.length < 8) {
    throw new Error(line(ctx.lang, "PIN manquant. Passez --pin ou KOINON_PIN (8 caractères minimum).", "Missing PIN. Pass --pin or KOINON_PIN (at least 8 characters)."));
  }
  const relay = ctx.relay;
  if (!relay) throw new Error(line(ctx.lang, "KOINON_RELAY manquant.", "KOINON_RELAY is missing."));
  const csv = Number(flags.csv ?? 10);
  const feeCap = flags["fee-cap"] ?? "100000";
  const name = flags.name ?? "Dahira Demo";
  mkdirSync(path.join(homeDir(), "keys"), { recursive: true });
  const made: Record<Role, { label: string; xpub: string; nostrPub: string }> = {} as Record<Role, { label: string; xpub: string; nostrPub: string }>;
  for (const role of ["O1", "O2", "O3", "K"] as const) {
    const mnemonic = mnemonicFromEntropy(crypto.getRandomValues(new Uint8Array(16)));
    const account = accountFromMnemonic(mnemonic, role, "regtest");
    const nostr = createIdentity();
    const sealed = await encryptKey(
      new TextEncoder().encode(JSON.stringify({ mnemonic, nostrSecretHex: Buffer.from(nostr.secretKey).toString("hex") })),
      pin,
    );
    writeFileSync(keyPath(role), `${JSON.stringify(sealed)}\n`, { mode: 0o600 });
    made[role] = { label: LABELS[role], xpub: account.xpub, nostrPub: nostr.publicKey };
  }
  const created = await api(ctx, "POST", "/v1/funds", {
    name,
    csv_blocks: csv,
    fee_cap_sats: feeCap,
    officers: (["O1", "O2", "O3"] as const).map((role) => ({ role, label: made[role].label, xpub: made[role].xpub })),
    assembly: { label: made.K.label, xpub: made.K.xpub },
  });
  const fundId = String(created.id);
  writeConfig({
    v: 1,
    fundId,
    name,
    coordinatorUrl: ctx.coordinator,
    relayUrl: relay,
    csvBlocks: csv,
    feeCapSats: feeCap,
    officers: { O1: made.O1, O2: made.O2, O3: made.O3 },
    assembly: made.K,
  });
  console.log(line(ctx.lang, `Fonds créé. ${fundId}`, `Fund created. ${fundId}`));
  console.log(line(ctx.lang, "Clés chiffrées. Réseau regtest, les sats n'ont pas de valeur.", "Keys encrypted. Network regtest, the sats have no value."));
}

export async function addMember(ctx: Runtime, pseudonym: string): Promise<void> {
  const config = readConfig(ctx.lang);
  const created = await api(ctx, "POST", `/v1/funds/${config.fundId}/members`, { pseudonym });
  console.log(line(ctx.lang, `Membre ${String(created.index)}. ${String(created.address)}`, `Member ${String(created.index)}. ${String(created.address)}`));
}

export async function contribute(ctx: Runtime, pseudonym: string, xofText: string): Promise<void> {
  const config = readConfig(ctx.lang);
  const xof = BigInt(xofText);
  const rate = await api(ctx, "GET", "/v1/rate");
  const eur = typeof rate.btc_eur === "string" ? rate.btc_eur : null;
  if (!eur) throw new Error("RATE_UNAVAILABLE");
  const members = await memberList(ctx, config.fundId);
  const member = members.find((item) => item.pseudonym === pseudonym);
  if (!member) throw new Error(line(ctx.lang, "Membre introuvable.", "Member not found."));
  const sats = satsForXof(xof, eur);
  const txid = String(await rpc(ctx, "sendtoaddress", [member.address, btcFromSats(sats)], true));
  console.log(line(
    ctx.lang,
    `Contribution envoyée. ${sats.toString()} sats pour ${xof.toString()} XOF. ${txid}`,
    `Contribution sent. ${sats.toString()} sats for ${xof.toString()} XOF. ${txid}`,
  ));
  console.log(line(ctx.lang, "Réseau regtest, les sats n'ont pas de valeur. Confirmez avec mine.", "Network regtest, the sats have no value. Confirm with mine."));
}

export async function status(ctx: Runtime): Promise<void> {
  const config = readConfig(ctx.lang);
  const fund = await api(ctx, "GET", `/v1/funds/${config.fundId}`);
  const ledger = await api(ctx, "GET", `/v1/funds/${config.fundId}/ledger`);
  const xof = fund.balance_xof == null ? line(ctx.lang, "taux indisponible", "rate unavailable") : String(fund.balance_xof);
  console.log(line(
    ctx.lang,
    `Solde ${String(fund.balance_sats)} sats (${xof} XOF). Réseau regtest, les sats n'ont pas de valeur.`,
    `Balance ${String(fund.balance_sats)} sats (${xof} XOF). Network regtest, the sats have no value.`,
  ));
  const entries = Array.isArray(ledger.entries) ? ledger.entries : [];
  if (entries.length === 0) {
    console.log(line(ctx.lang, "Aucune écriture.", "No entries."));
    return;
  }
  for (const entry of entries) {
    const row = entry as { kind?: string; sats?: string; confirmations?: number; txid?: string };
    console.log(`${row.kind ?? ""} ${row.sats ?? ""} sats conf ${String(row.confirmations ?? "")} ${row.txid ?? ""}`);
  }
}

export async function requestSpend(ctx: Runtime, xofText: string, address: string, purpose: string, role: Role): Promise<void> {
  if (role === "K") throw new Error(line(ctx.lang, "L'assemblée ne crée pas une dépense.", "The assembly key cannot open a spend."));
  const config = readConfig(ctx.lang);
  const secret = await openKey(ctx, role);
  const created = await api(ctx, "POST", `/v1/funds/${config.fundId}/requests`, {
    role,
    recipient: address,
    purpose,
    amount_xof: Number(xofText),
    path: "A",
  }, { role, mnemonic: secret.mnemonic });
  const message = {
    type: "koinon.spend_request.v1" as const,
    request_id: String(created.id),
    fund_id: config.fundId,
    amount_xof: Number(created.amount_xof),
    amount_sats: String(created.amount_sats),
    recipient: address,
    purpose,
    expires_at: String(created.expires_at),
    coordinator_url: ctx.coordinator,
    path: "A" as const,
  };
  await sendTo(ctx, secret.nostrSecret, others(role).map((item) => config.officers[item].nostrPub), message);
  console.log(line(
    ctx.lang,
    `Demande ${String(created.id)}. ${String(created.amount_sats)} sats verrouillés pour ${xofText} XOF.`,
    `Request ${String(created.id)}. ${String(created.amount_sats)} sats locked for ${xofText} XOF.`,
  ));
}

export async function approve(ctx: Runtime, requestId: string, role: Role): Promise<void> {
  const config = readConfig(ctx.lang);
  const secret = await openKey(ctx, role);
  const request = await api(ctx, "GET", `/v1/requests/${requestId}`);
  const decision = await decide(ctx, config, request, secret.mnemonic, role);
  if (decision.action !== "approve") {
    const detail = decision.action === "refused" ? decision.code : decision.reason;
    throw new Error(line(ctx.lang, `REFUS ${detail}. Aucune signature.`, `REFUSE ${detail}. No signature.`));
  }
  const posted = await api(ctx, "POST", `/v1/requests/${requestId}/signatures`, { psbt: decision.signedPsbt }, { role, mnemonic: secret.mnemonic });
  const requester = String(request.requester) as Role;
  const pub = requester === "K" ? config.assembly.nostrPub : config.officers[requester].nostrPub;
  await sendTo(ctx, secret.nostrSecret, [pub], decision.message);
  console.log(line(ctx.lang, `Signature acceptée. Statut ${String(posted.status)}.`, `Signature accepted. Status ${String(posted.status)}.`));
}

export async function reject(ctx: Runtime, requestId: string, role: Role, reason: string): Promise<void> {
  const config = readConfig(ctx.lang);
  const secret = await openKey(ctx, role);
  await api(ctx, "POST", `/v1/requests/${requestId}/reject`, { reason }, { role, mnemonic: secret.mnemonic });
  const request = await api(ctx, "GET", `/v1/requests/${requestId}`);
  const requester = String(request.requester) as Role;
  const pub = requester === "K" ? config.assembly.nostrPub : config.officers[requester].nostrPub;
  await sendTo(ctx, secret.nostrSecret, [pub], {
    type: "koinon.spend_rejection.v1",
    request_id: requestId,
    fund_id: config.fundId,
    officer: role,
    reason,
  });
  console.log(line(ctx.lang, "Demande refusée.", "Request rejected."));
}

export async function broadcast(ctx: Runtime, requestId: string): Promise<void> {
  const config = readConfig(ctx.lang);
  const result = await api(ctx, "POST", `/v1/requests/${requestId}/broadcast`);
  console.log(line(ctx.lang, `Transaction diffusée. ${String(result.txid)}`, `Transaction broadcast. ${String(result.txid)}`));
}

export async function attackSingleSig(ctx: Runtime, requestId: string, role: Role): Promise<void> {
  if (role === "K") throw new Error(line(ctx.lang, "L'assemblée ne signe pas cette attaque.", "The assembly key does not sign this attack."));
  const config = readConfig(ctx.lang);
  const secret = await openKey(ctx, role);
  const request = await api(ctx, "GET", `/v1/requests/${requestId}`);
  const keys = policyKeys(config);
  const psbt = psbtFromBase64(String(request.psbt), "regtest");
  const verified = verifySpend(psbt, {
    network: "regtest",
    keys,
    recipient: String(request.recipient),
    amount: BigInt(String(request.amount_sats)),
    feeCap: BigInt(config.feeCapSats),
    memberIndexes: await indexes(ctx, config.fundId),
    mode: "path-a",
  });
  signFundPsbt({ psbt, mnemonic: secret.mnemonic, network: "regtest", inputs: verified.inputs });
  const hex = finalizeFundPsbt({ psbt, keys, network: "regtest", mode: "single-sig-attack", inputs: verified.inputs });
  try {
    const txid = await rpc(ctx, "sendrawtransaction", [hex]);
    throw new Error(line(ctx.lang, `ECHEC l'attaque a été acceptée. ${String(txid)}`, `FAIL the attack was accepted. ${String(txid)}`));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("ECHEC")) throw error;
    if (error instanceof Error && error.message.startsWith("FAIL")) throw error;
    const message = error instanceof Error ? error.message : "error";
    console.log(line(ctx.lang, `REFUS bitcoind. ${message}`, `REFUSE bitcoind. ${message}`));
  }
}

export async function attackTamper(ctx: Runtime, requestId: string, role: Role): Promise<void> {
  const config = readConfig(ctx.lang);
  const request = await api(ctx, "GET", `/v1/requests/${requestId}`);
  const swapped = swapRecipient(String(request.psbt));
  const psbt = psbtFromBase64(swapped, "regtest");
  try {
    verifySpend(psbt, {
      network: "regtest",
      keys: policyKeys(config),
      recipient: String(request.recipient),
      amount: BigInt(String(request.amount_sats)),
      feeCap: BigInt(config.feeCapSats),
      memberIndexes: await indexes(ctx, config.fundId),
      mode: request.path === "B" ? "path-b" : "path-a",
    });
    throw new Error(line(ctx.lang, "ECHEC la demande modifiée a été acceptée.", "FAIL the altered request was accepted."));
  } catch (error) {
    if (error instanceof KoinonError && error.code === "PSBT_MISMATCH") {
      console.log(line(ctx.lang, `REFUS PSBT_MISMATCH. ${role} n'a pas signé.`, `REFUSE PSBT_MISMATCH. ${role} did not sign.`));
      return;
    }
    throw error;
  }
}

export async function recover(ctx: Runtime, address: string, role: Role): Promise<void> {
  if (role === "K") throw new Error(line(ctx.lang, "Choisissez un officier avec --as.", "Choose an officer with --as."));
  const config = readConfig(ctx.lang);
  const officer = await openKey(ctx, role);
  const assembly = await openKey(ctx, "K");
  const ledger = await api(ctx, "GET", `/v1/funds/${config.fundId}/ledger`);
  const entries = (Array.isArray(ledger.entries) ? ledger.entries : []) as {
    kind?: string;
    txid?: string;
    vout?: number | null;
    index?: number | null;
    sats?: string;
  }[];
  for (const entry of entries) {
    if (entry.kind !== "contribution" || !entry.txid || entry.vout == null || entry.index == null || !entry.sats) continue;
    const live = await rpc(ctx, "gettxout", [entry.txid, entry.vout]);
    if (!live) continue;
    const value = BigInt(entry.sats);
    const pay = value - 1_000n;
    if (pay < 546n) continue;
    const keys = policyKeys(config);
    const input = { txid: entry.txid, vout: entry.vout, value, change: 0 as const, index: entry.index };
    const psbt = createFundPsbt({
      network: "regtest",
      keys,
      inputs: [input],
      outputs: [{ address, value: pay }],
      mode: "path-b",
    });
    signFundPsbt({ psbt, mnemonic: officer.mnemonic, network: "regtest", inputs: [input] });
    signFundPsbt({ psbt, mnemonic: assembly.mnemonic, network: "regtest", inputs: [input] });
    const hex = finalizeFundPsbt({ psbt, keys, network: "regtest", mode: "path-b", inputs: [input] });
    try {
      const txid = String(await rpc(ctx, "sendrawtransaction", [hex]));
      console.log(line(ctx.lang, `Récupération acceptée. ${txid}`, `Recovery accepted. ${txid}`));
    } catch (error) {
      const message = error instanceof Error ? error.message : "error";
      console.log(line(ctx.lang, `REFUS bitcoind. ${message}`, `REFUSE bitcoind. ${message}`));
    }
    return;
  }
  throw new Error(line(ctx.lang, "Aucune pièce disponible.", "No coin is available."));
}

export async function mine(ctx: Runtime, count: number): Promise<void> {
  const address = String(await rpc(ctx, "getnewaddress", [], true));
  await rpc(ctx, "generatetoaddress", [count, address], true);
  const fr = count === 1 ? "1 bloc miné." : `${count} blocs minés.`;
  const en = count === 1 ? "1 block mined." : `${count} blocks mined.`;
  console.log(line(ctx.lang, fr, en));
}

export async function audit(ctx: Runtime): Promise<void> {
  const config = readConfig(ctx.lang);
  const result = await api(ctx, "GET", `/v1/funds/${config.fundId}/audit/verify`);
  if (result.ok === true) {
    console.log(line(ctx.lang, "Audit intact.", "Audit intact."));
    return;
  }
  throw new Error(line(ctx.lang, `Audit rompu au rang ${String(result.seq)}.`, `Audit broken at seq ${String(result.seq)}.`));
}

async function decide(ctx: Runtime, config: FundConfig, request: Record<string, unknown>, mnemonic: string, role: Role) {
  return decideSpend({
    message: {
      type: "koinon.spend_request.v1",
      request_id: String(request.id),
      fund_id: config.fundId,
      amount_xof: Number(request.amount_xof),
      amount_sats: String(request.amount_sats),
      recipient: String(request.recipient),
      purpose: String(request.purpose),
      expires_at: String(request.expires_at),
      coordinator_url: ctx.coordinator,
      path: request.path === "B" ? "B" : "A",
    },
    now: new Date(),
    coordinatorUrl: ctx.coordinator,
    officer: role,
    mnemonic,
    fund: {
      network: "regtest",
      keys: policyKeys(config),
      feeCap: BigInt(config.feeCapSats),
      memberIndexes: await indexes(ctx, config.fundId),
    },
    loadPsbt: async () => String(request.psbt),
  });
}

async function sendTo(ctx: Runtime, sender: Uint8Array, recipients: string[], message: Parameters<typeof publishMessage>[0]["message"]): Promise<void> {
  const relay = ctx.relay ?? readConfig(ctx.lang).relayUrl;
  const pool = openPool();
  try {
    for (const recipientPublicKey of recipients) {
      await publishMessage({ pool, relayUrl: relay, sender, recipientPublicKey, message });
    }
  } finally {
    pool.destroy();
  }
}

function others(role: Role): Array<"O1" | "O2" | "O3"> {
  return (["O1", "O2", "O3"] as const).filter((item) => item !== role);
}

function policyKeys(config: FundConfig): PolicyKeys {
  return {
    officers: [
      { role: "O1", xpub: config.officers.O1.xpub, path: ACCOUNT_PATH },
      { role: "O2", xpub: config.officers.O2.xpub, path: ACCOUNT_PATH },
      { role: "O3", xpub: config.officers.O3.xpub, path: ACCOUNT_PATH },
    ],
    assembly: { role: "K", xpub: config.assembly.xpub, path: ACCOUNT_PATH },
    csvBlocks: config.csvBlocks,
  };
}

async function memberList(ctx: Runtime, fundId: string): Promise<{ pseudonym: string; address: string; index: number }[]> {
  const body = await api(ctx, "GET", `/v1/funds/${fundId}/members`);
  return (Array.isArray(body.members) ? body.members : []) as { pseudonym: string; address: string; index: number }[];
}

async function indexes(ctx: Runtime, fundId: string): Promise<number[]> {
  const members = await memberList(ctx, fundId);
  return members.map((member) => member.index);
}

function swapRecipient(base64: string): string {
  const network = bitcoinNetwork("regtest");
  const original = Psbt.fromBase64(base64, { network });
  const fresh = new Psbt({ network });
  fresh.setMaximumFeeRate(100_000);
  const output = original.txOutputs[0];
  if (!output) throw new Error("missing output");
  const script = Buffer.from(output.script);
  script[script.length - 1] = (script[script.length - 1] ?? 0) ^ 1;
  original.txInputs.forEach((input, index) => {
    const data = original.data.inputs[index];
    if (!data?.witnessUtxo || !data.witnessScript) throw new Error("incomplete psbt");
    fresh.addInput({
      hash: input.hash,
      index: input.index,
      sequence: input.sequence,
      witnessUtxo: data.witnessUtxo,
      witnessScript: data.witnessScript,
    });
  });
  original.txOutputs.forEach((item, index) => {
    if (index === 0) fresh.addOutput({ script, value: item.value });
    else fresh.addOutput({ script: item.script, value: item.value });
  });
  return fresh.toBase64();
}
