import path from "node:path";
import { fileURLToPath } from "node:url";
import { Psbt } from "bitcoinjs-lib";
import {
  accountFromMnemonic,
  accountSigner,
  authPayload,
  bitcoinNetwork,
  mnemonicFromEntropy,
  signAuth,
  signFundPsbt,
  type Role,
} from "@koinon/core";
import { buildApp } from "../src/app.ts";
import { bitcoinRpc } from "../src/bitcoin.ts";
import { openDatabase } from "../src/db.ts";
import { startRegtest } from "../../../scripts/regtest.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const NOW = new Date();

function entropy(byte: number): Uint8Array {
  return new Uint8Array(16).fill(byte);
}

function mnemonic(byte: number): string {
  return mnemonicFromEntropy(entropy(byte));
}

function account(byte: number, role: Role) {
  return accountFromMnemonic(mnemonic(byte), role, "regtest");
}

async function call(
  app: ReturnType<typeof buildApp>,
  method: string,
  url: string,
  body?: unknown,
  auth?: { role: Role; byte: number },
): Promise<{ status: number; json: Record<string, unknown> }> {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (auth) {
    const nonce = crypto.randomUUID().replaceAll("-", "");
    const payload = authPayload({
      method,
      path: new URL(url, "http://koinon.local").pathname,
      timestamp: NOW.getTime(),
      nonce,
      body: new TextEncoder().encode(raw),
    });
    headers.authorization = `Koinon ${auth.role} ${NOW.getTime()} ${nonce} ${signAuth(accountSigner(mnemonic(auth.byte), "regtest"), payload)}`;
  }
  const response = await app.inject({
    method: method as "GET",
    url,
    headers,
    payload: body === undefined ? undefined : raw,
  });
  return { status: response.statusCode, json: response.body ? (JSON.parse(response.body) as Record<string, unknown>) : {} };
}

function signStored(psbtBase64: string, byte: number): string {
  const psbt = Psbt.fromBase64(psbtBase64, { network: bitcoinNetwork("regtest") });
  signFundPsbt({
    psbt,
    mnemonic: mnemonic(byte),
    network: "regtest",
    inputs: psbt.txInputs.map(() => ({ change: 0 as const, index: 0 })),
  });
  return psbt.toBase64();
}

function swapped(psbtBase64: string, address: string): string {
  const original = Psbt.fromBase64(psbtBase64, { network: bitcoinNetwork("regtest") });
  const fresh = new Psbt({ network: bitcoinNetwork("regtest") });
  fresh.setMaximumFeeRate(100_000);
  original.txInputs.forEach((input, index) => {
    const data = original.data.inputs[index];
    if (!data?.witnessUtxo || !data.witnessScript) throw new Error("psbt input is incomplete");
    fresh.addInput({
      hash: input.hash,
      index: input.index,
      sequence: input.sequence,
      witnessUtxo: data.witnessUtxo,
      witnessScript: data.witnessScript,
    });
  });
  original.txOutputs.forEach((output, index) => {
    if (index === 0) fresh.addOutput({ address, value: output.value });
    else fresh.addOutput({ script: output.script, value: output.value });
  });
  return fresh.toBase64();
}

async function main(): Promise<void> {
  const regtest = await startRegtest(root);
  const db = openDatabase(":memory:");
  const bitcoin = bitcoinRpc({ url: "http://127.0.0.1:18445", user: "koinon", password: "koinon" });
  const app = buildApp({
    db,
    bitcoin,
    now: () => NOW,
    logger: false,
  });
  let spendApp = app;
  const lines: string[] = [];
  const note = (label: string, ok: boolean, detail: string) => {
    lines.push(`${ok ? "PASS" : "FAIL"} ${label}: ${detail}`);
  };
  try {
    const version = (await regtest.rpc("getnetworkinfo", [])) as { subversion: string };
    console.log(`bitcoind: ${version.subversion}`);
    console.log("network: regtest");
    console.log("regtest sats have no value");
    await regtest.rpc("createwallet", ["bootstrap"]);
    const mineTo = (await regtest.rpc("getnewaddress", [], "bootstrap")) as string;
    await regtest.rpc("generatetoaddress", [101, mineTo]);

    const created = await call(app, "POST", "/v1/funds", {
      name: "Dahira Demo",
      csv_blocks: 10,
      fee_cap_sats: "100000",
      officers: [
        { role: "O1", label: "O1", xpub: account(0x11, "O1").xpub },
        { role: "O2", label: "O2", xpub: account(0x22, "O2").xpub },
        { role: "O3", label: "O3", xpub: account(0x33, "O3").xpub },
      ],
      assembly: { label: "K", xpub: account(0x44, "K").xpub },
    });
    const fundId = String(created.json.id ?? "");
    note("fund", created.status === 201, fundId);
    const member = await call(app, "POST", `/v1/funds/${fundId}/members`, { pseudonym: "membre-1" });
    const memberAddress = String(member.json.address ?? "");
    note("member", member.status === 201, memberAddress);
    const funded = (await regtest.rpc("sendtoaddress", [memberAddress, "0.05"], "bootstrap")) as string;
    await regtest.rpc("generatetoaddress", [1, mineTo]);
    const fund = await call(app, "GET", `/v1/funds/${fundId}`);
    note("contribution", fund.json.balance_sats === "5000000", `sats ${String(fund.json.balance_sats)} tx ${funded}`);

    const recipient = (await regtest.rpc("getnewaddress", [], "bootstrap")) as string;
    const other = (await regtest.rpc("getnewaddress", [], "bootstrap")) as string;
    const request = await call(
      app,
      "POST",
      `/v1/funds/${fundId}/requests`,
      { role: "O1", recipient, purpose: "fournitures", amount_xof: 1000, path: "A" },
      { role: "O1", byte: 0x11 },
    );
    let openRequest = request;
    if (request.json.code === "RATE_UNAVAILABLE") {
      lines.push("NOTE live rate: RATE_UNAVAILABLE. mempool.space did not answer. The spend below uses a test double of 60000 EUR, not a market price.");
      spendApp = buildApp({
        db,
        bitcoin,
        fetchEur: async () => "60000",
        now: () => NOW,
        logger: false,
      });
      openRequest = await call(
        spendApp,
        "POST",
        `/v1/funds/${fundId}/requests`,
        { role: "O1", recipient, purpose: "fournitures", amount_xof: 1000, path: "A" },
        { role: "O1", byte: 0x11 },
      );
    } else {
      lines.push(`NOTE live rate: fetched, locked sats ${String(request.json.amount_sats)}`);
    }
    note("request", openRequest.status === 201, `status ${String(openRequest.json.status)} sats ${String(openRequest.json.amount_sats)}`);
    const requestId = String(openRequest.json.id);
    const psbt = String(openRequest.json.psbt);

    const tampered = await call(
      spendApp,
      "POST",
      `/v1/requests/${requestId}/signatures`,
      { psbt: swapped(psbt, other) },
      { role: "O1", byte: 0x11 },
    );
    note("tamper", tampered.json.code === "PSBT_MISMATCH", String(tampered.json.code));

    await call(spendApp, "POST", `/v1/requests/${requestId}/signatures`, { psbt: signStored(psbt, 0x11) }, { role: "O1", byte: 0x11 });
    const duplicate = await call(
      spendApp,
      "POST",
      `/v1/requests/${requestId}/signatures`,
      { psbt: signStored(psbt, 0x11) },
      { role: "O1", byte: 0x11 },
    );
    note("duplicate", duplicate.json.code === "ALREADY_SIGNED", String(duplicate.json.code));

    db.prepare("UPDATE requests SET expires_at = ? WHERE id = ?").run(new Date(NOW.getTime() - 60_000).toISOString(), requestId);
    const expired = await call(
      spendApp,
      "POST",
      `/v1/requests/${requestId}/signatures`,
      { psbt: signStored(psbt, 0x22) },
      { role: "O2", byte: 0x22 },
    );
    note("expire", expired.json.code === "REQUEST_EXPIRED", String(expired.json.code));

    const again = await call(
      spendApp,
      "POST",
      `/v1/funds/${fundId}/requests`,
      { role: "O1", recipient, purpose: "fournitures", amount_xof: 1000, path: "A" },
      { role: "O1", byte: 0x11 },
    );
    const againId = String(again.json.id ?? "");
    const againPsbt = String(again.json.psbt ?? "");
    await call(spendApp, "POST", `/v1/requests/${againId}/signatures`, { psbt: signStored(againPsbt, 0x11) }, { role: "O1", byte: 0x11 });
    const approved = await call(
      spendApp,
      "POST",
      `/v1/requests/${againId}/signatures`,
      { psbt: signStored(againPsbt, 0x22) },
      { role: "O2", byte: 0x22 },
    );
    note("two signatures", approved.json.status === "approved", String(approved.json.status));
    const sent = await call(spendApp, "POST", `/v1/requests/${againId}/broadcast`);
    note("broadcast", sent.status === 200, String(sent.json.txid ?? sent.json.code));
    await regtest.rpc("generatetoaddress", [1, mineTo]);
    const ledger = await call(spendApp, "GET", `/v1/funds/${fundId}/ledger`);
    const kinds = ((ledger.json.entries as { kind: string }[] | undefined) ?? []).map((entry) => entry.kind).sort();
    note("ledger", kinds.includes("contribution") && kinds.includes("spend"), kinds.join(","));
    const verified = await call(spendApp, "GET", `/v1/funds/${fundId}/audit/verify`);
    note("audit", verified.json.ok === true, String(verified.json.ok));
    db.prepare("UPDATE audit SET detail = detail || 'x' WHERE fund_id = ? AND seq = 1").run(fundId);
    const broken = await call(spendApp, "GET", `/v1/funds/${fundId}/audit/verify`);
    note("audit tamper", broken.json.ok === false, `seq ${String(broken.json.seq)}`);
    console.log(lines.join("\n"));
    if (lines.some((line) => line.startsWith("FAIL"))) process.exitCode = 1;
  } finally {
    await app.close();
    if (spendApp !== app) await spendApp.close();
    await regtest.stop();
  }
}

await main();
