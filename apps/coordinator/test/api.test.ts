import { Block, Psbt, Transaction, payments } from "bitcoinjs-lib";
import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import {
  accountFromMnemonic,
  accountSigner,
  accountPubkey,
  authPayload,
  bitcoinNetwork,
  mnemonicFromEntropy,
  outputScript,
  signAuth,
  signFundPsbt,
  type Role,
} from "@koinon/core";
import { buildApp } from "../src/app.js";
import type { BitcoinClient } from "../src/bitcoin.js";
import { openDatabase } from "../src/db.js";

const NOW = new Date("2026-11-17T12:00:00.000Z");

function entropy(byte: number): Uint8Array {
  return new Uint8Array(16).fill(byte);
}

function mnemonic(byte: number): string {
  return mnemonicFromEntropy(entropy(byte));
}

function xpub(byte: number, role: Role): string {
  return accountFromMnemonic(mnemonic(byte), role, "regtest").xpub;
}

function addressOf(byte: number): string {
  const pubkey = accountPubkey(xpub(byte, "O1"), "regtest");
  const address = payments.p2wpkh({ pubkey, network: bitcoinNetwork("regtest") }).address;
  if (!address) throw new Error("could not derive an address");
  return address;
}

function chain(blocks: string[], seen: string[], mempool: string[] = []): BitcoinClient {
  return {
    async getBlockCount() {
      return blocks.length - 1;
    },
    async getBlockHash(height) {
      return `h${height}`;
    },
    async getBlockHex(hash) {
      const hex = blocks[Number(hash.slice(1))];
      if (!hex) throw new Error("missing block");
      return hex;
    },
    async sendRawTransaction(hex) {
      seen.push(hex);
      return Transaction.fromHex(hex).getId();
    },
    async getMempoolHex() {
      return [...mempool];
    },
  };
}

function payBlock(address: string, sats: bigint): string {
  const tx = new Transaction();
  tx.version = 2;
  tx.addInput(new Uint8Array(32), 0xffffffff, 0xffffffff, new Uint8Array([1]));
  tx.addOutput(outputScript(address, "regtest"), sats);
  const block = new Block();
  block.version = 1;
  block.prevHash = new Uint8Array(32);
  block.merkleRoot = new Uint8Array(32);
  block.timestamp = 1_700_000_000;
  block.bits = 0x207fffff;
  block.nonce = 1;
  block.transactions = [tx];
  return block.toHex();
}

function hashFromTxid(txid: string): Uint8Array {
  return Uint8Array.from(Buffer.from(txid, "hex").reverse());
}

function spendBlock(hex: string): string {
  const block = new Block();
  block.version = 1;
  block.prevHash = new Uint8Array(32);
  block.merkleRoot = new Uint8Array(32);
  block.timestamp = 1_700_000_001;
  block.bits = 0x207fffff;
  block.nonce = 2;
  block.transactions = [Transaction.fromHex(hex)];
  return block.toHex();
}

async function call(
  app: FastifyInstance,
  method: string,
  url: string,
  body?: unknown,
  auth?: { role: Role; mnemonic: string },
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
    headers.authorization = `Koinon ${auth.role} ${NOW.getTime()} ${nonce} ${signAuth(accountSigner(auth.mnemonic, "regtest"), payload)}`;
  }
  const response = await app.inject({
    method: method as "GET",
    url,
    headers,
    payload: body === undefined ? undefined : raw,
  });
  return { status: response.statusCode, json: response.body ? (JSON.parse(response.body) as Record<string, unknown>) : {} };
}

function signStored(psbtBase64: string, officer: string): string {
  const psbt = Psbt.fromBase64(psbtBase64, { network: bitcoinNetwork("regtest") });
  signFundPsbt({
    psbt,
    mnemonic: officer,
    network: "regtest",
    inputs: psbt.txInputs.map(() => ({ change: 0 as const, index: 0 })),
  });
  return psbt.toBase64();
}

function swappedRecipient(psbtBase64: string, address: string): string {
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

describe("coordinator", () => {
  it("keeps the fund rule, the locked rate, and the audit chain", async () => {
    const lines: string[] = [];
    const blocks = [Buffer.alloc(80).toString("hex")];
    const broadcast: string[] = [];
    const db = openDatabase(":memory:");
    const app = buildApp({
      db,
      bitcoin: chain(blocks, broadcast),
      fetchEur: async () => "60000",
      now: () => NOW,
      logger: { stream: { write: (message) => lines.push(message) } },
    });
    const officers = {
      O1: mnemonic(0x11),
      O2: mnemonic(0x22),
      O3: mnemonic(0x33),
      K: mnemonic(0x44),
    };
    const created = await call(app, "POST", "/v1/funds", {
      name: "Dahira Demo",
      csv_blocks: 10,
      fee_cap_sats: "100000",
      officers: [
        { role: "O1", label: "O1", xpub: xpub(0x11, "O1") },
        { role: "O2", label: "O2", xpub: xpub(0x22, "O2") },
        { role: "O3", label: "O3", xpub: xpub(0x33, "O3") },
      ],
      assembly: { label: "K", xpub: xpub(0x44, "K") },
    });
    expect(created.status).toBe(201);
    const fundId = created.json.id as string;

    const member = await call(app, "POST", `/v1/funds/${fundId}/members`, { pseudonym: "SECRET-PSEUDONYM-XQ" });
    expect(member.status).toBe(201);
    blocks.push(payBlock(member.json.address as string, 100_000_000n));

    const fund = await call(app, "GET", `/v1/funds/${fundId}`);
    expect(fund.json.balance_sats).toBe("100000000");
    expect(fund.json.balance_xof).toBeTruthy();
    expect((fund.json.rate as { regtest_sats_have_no_value: boolean }).regtest_sats_have_no_value).toBe(true);
    expect((fund.json.rate as { network: string }).network).toBe("regtest");

    const body = {
      role: "O1",
      recipient: addressOf(0x55),
      purpose: "SECRET-PURPOSE-XQ",
      amount_xof: 1000,
      path: "A",
    };
    const request = await call(app, "POST", `/v1/funds/${fundId}/requests`, body, { role: "O1", mnemonic: officers.O1 });
    expect(request.status).toBe(201);
    expect(request.json.status).toBe("pending");
    expect(request.json.amount_xof).toBe("1000");
    const requestId = request.json.id as string;
    const psbt = request.json.psbt as string;

    const tampered = await call(
      app,
      "POST",
      `/v1/requests/${requestId}/signatures`,
      { psbt: swappedRecipient(psbt, addressOf(0x66)) },
      { role: "O1", mnemonic: officers.O1 },
    );
    expect(tampered.status).toBe(422);
    expect(tampered.json.code).toBe("PSBT_MISMATCH");

    const first = await call(
      app,
      "POST",
      `/v1/requests/${requestId}/signatures`,
      { psbt: signStored(psbt, officers.O1) },
      { role: "O1", mnemonic: officers.O1 },
    );
    expect(first.status).toBe(200);
    expect(first.json.status).toBe("pending");

    const again = await call(
      app,
      "POST",
      `/v1/requests/${requestId}/signatures`,
      { psbt: signStored(psbt, officers.O1) },
      { role: "O1", mnemonic: officers.O1 },
    );
    expect(again.json.code).toBe("ALREADY_SIGNED");

    const blocked = await call(app, "POST", `/v1/funds/${fundId}/requests`, { ...body, role: "O2", purpose: "autre" }, {
      role: "O2",
      mnemonic: officers.O2,
    });
    expect(blocked.json.code).toBe("INSUFFICIENT_FUNDS");

    db.prepare("UPDATE requests SET expires_at = ? WHERE id = ?").run("2026-11-17T11:00:00.000Z", requestId);
    const expired = await call(
      app,
      "POST",
      `/v1/requests/${requestId}/signatures`,
      { psbt: signStored(psbt, officers.O2) },
      { role: "O2", mnemonic: officers.O2 },
    );
    expect(expired.json.code).toBe("REQUEST_EXPIRED");

    const veto = await call(app, "POST", `/v1/funds/${fundId}/requests`, body, { role: "O1", mnemonic: officers.O1 });
    expect(veto.status).toBe(201);
    const rejected = await call(
      app,
      "POST",
      `/v1/requests/${veto.json.id as string}/reject`,
      { reason: "SECRET-REASON-XQ" },
      { role: "O3", mnemonic: officers.O3 },
    );
    expect(rejected.json.status).toBe("rejected");

    const open = await call(app, "POST", `/v1/funds/${fundId}/requests`, body, { role: "O1", mnemonic: officers.O1 });
    expect(open.status).toBe(201);
    const openPsbt = open.json.psbt as string;
    const openId = open.json.id as string;
    await call(app, "POST", `/v1/requests/${openId}/signatures`, { psbt: signStored(openPsbt, officers.O1) }, { role: "O1", mnemonic: officers.O1 });
    const second = await call(
      app,
      "POST",
      `/v1/requests/${openId}/signatures`,
      { psbt: signStored(openPsbt, officers.O2) },
      { role: "O2", mnemonic: officers.O2 },
    );
    expect(second.json.status).toBe("approved");

    const sent = await call(app, "POST", `/v1/requests/${openId}/broadcast`);
    expect(sent.status).toBe(200);
    expect(typeof sent.json.txid).toBe("string");
    blocks.push(spendBlock(broadcast[0] ?? ""));

    const ledger = await call(app, "GET", `/v1/funds/${fundId}/ledger`);
    const entries = ledger.json.entries as { kind: string }[];
    expect(entries.map((entry) => entry.kind).sort()).toEqual(["contribution", "spend"]);

    const verified = await call(app, "GET", `/v1/funds/${fundId}/audit/verify`);
    expect(verified.json.ok).toBe(true);
    db.prepare("UPDATE audit SET detail = detail || 'x' WHERE fund_id = ? AND seq = 1").run(fundId);
    const broken = await call(app, "GET", `/v1/funds/${fundId}/audit/verify`);
    expect(broken.json.ok).toBe(false);
    expect(broken.json.seq).toBe(1);

    const logged = lines.join("\n");
    expect(logged).not.toContain("SECRET-PSEUDONYM-XQ");
    expect(logged).not.toContain("SECRET-PURPOSE-XQ");
    expect(logged).not.toContain("SECRET-REASON-XQ");
    expect(logged).not.toContain(psbt.slice(0, 40));
    await app.close();
  });

  it("refuses a spend when no rate has ever been fetched", async () => {
    const db = openDatabase(":memory:");
    const app = buildApp({
      db,
      bitcoin: chain([Buffer.alloc(80).toString("hex")], []),
      fetchEur: async () => {
        throw new Error("offline");
      },
      now: () => NOW,
      logger: false,
    });
    const created = await call(app, "POST", "/v1/funds", fundBody());
    const fundId = created.json.id as string;
    const refused = await call(
      app,
      "POST",
      `/v1/funds/${fundId}/requests`,
      {
        role: "O1",
        recipient: addressOf(0x55),
        purpose: "fournitures",
        amount_xof: 1000,
        path: "A",
      },
      { role: "O1", mnemonic: mnemonic(0x11) },
    );
    expect(refused.status).toBe(503);
    expect(refused.json.code).toBe("RATE_UNAVAILABLE");
    await app.close();
  });

  it("lists a recovery spend with no request on the ledger", async () => {
    const blocks = [Buffer.alloc(80).toString("hex")];
    const db = openDatabase(":memory:");
    const app = buildApp({
      db,
      bitcoin: chain(blocks, []),
      fetchEur: async () => "60000",
      now: () => NOW,
      logger: false,
    });
    const created = await call(app, "POST", "/v1/funds", fundBody());
    const fundId = created.json.id as string;
    const member = await call(app, "POST", `/v1/funds/${fundId}/members`, { pseudonym: "Awa" });
    blocks.push(payBlock(member.json.address as string, 100_000_000n));

    const before = await call(app, "GET", `/v1/funds/${fundId}/ledger`);
    const contribution = (before.json.entries as { kind: string; txid: string; vout: number; xof_at_receipt: string }[]).find(
      (entry) => entry.kind === "contribution",
    );
    expect(contribution).toBeTruthy();

    const spend = new Transaction();
    spend.version = 2;
    spend.addInput(hashFromTxid(contribution!.txid), contribution!.vout);
    spend.addOutput(outputScript(addressOf(0x55), "regtest"), 99_000_000n);
    blocks.push(spendBlock(spend.toHex()));

    const ledger = await call(app, "GET", `/v1/funds/${fundId}/ledger`);
    const entries = ledger.json.entries as {
      kind: string;
      request_id: string | null;
      txid: string;
      sats: string;
      xof_at_receipt: string | null;
      confirmations: number;
    }[];
    const recovery = entries.find((entry) => entry.kind === "spend");
    expect(recovery).toMatchObject({
      txid: spend.getId(),
      request_id: null,
      sats: "99000000",
      xof_at_receipt: contribution!.xof_at_receipt,
      confirmations: 1,
    });
    expect(entries.some((entry) => entry.kind === "contribution")).toBe(true);

    const fund = await call(app, "GET", `/v1/funds/${fundId}`);
    expect(fund.json.balance_sats).toBe("0");
    await app.close();
  });

  it("lists an unconfirmed recovery from the mempool with the due's francs", async () => {
    const blocks = [Buffer.alloc(80).toString("hex")];
    const mempool: string[] = [];
    const db = openDatabase(":memory:");
    const app = buildApp({
      db,
      bitcoin: chain(blocks, [], mempool),
      fetchEur: async () => "60000",
      now: () => NOW,
      logger: false,
    });
    const created = await call(app, "POST", "/v1/funds", fundBody());
    const fundId = created.json.id as string;
    const member = await call(app, "POST", `/v1/funds/${fundId}/members`, { pseudonym: "Awa" });
    blocks.push(payBlock(member.json.address as string, 100_000_000n));

    const before = await call(app, "GET", `/v1/funds/${fundId}/ledger`);
    const contribution = (before.json.entries as { kind: string; txid: string; vout: number; xof_at_receipt: string }[]).find(
      (entry) => entry.kind === "contribution",
    );
    expect(contribution).toBeTruthy();

    const spend = new Transaction();
    spend.version = 2;
    spend.addInput(hashFromTxid(contribution!.txid), contribution!.vout);
    spend.addOutput(outputScript(addressOf(0x55), "regtest"), 99_000_000n);
    mempool.push(spend.toHex());

    const pending = await call(app, "GET", `/v1/funds/${fundId}/ledger`);
    const recovery = (pending.json.entries as { kind: string; confirmations: number; xof_at_receipt: string | null; request_id: string | null }[]).find(
      (entry) => entry.kind === "spend",
    );
    expect(recovery).toMatchObject({
      request_id: null,
      confirmations: 0,
      xof_at_receipt: contribution!.xof_at_receipt,
    });
    const fund = await call(app, "GET", `/v1/funds/${fundId}`);
    expect(fund.json.balance_sats).toBe("0");
    await app.close();
  });
});

function fundBody() {
  return {
    name: "Dahira Demo",
    csv_blocks: 10,
    fee_cap_sats: "100000",
    officers: [
      { role: "O1", label: "O1", xpub: xpub(0x11, "O1") },
      { role: "O2", label: "O2", xpub: xpub(0x22, "O2") },
      { role: "O3", label: "O3", xpub: xpub(0x33, "O3") },
    ],
    assembly: { label: "K", xpub: xpub(0x44, "K") },
  };
}
