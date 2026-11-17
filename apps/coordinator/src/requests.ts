import { Psbt } from "bitcoinjs-lib";
import type { DatabaseSync } from "node:sqlite";
import {
  ErrorCode,
  KoinonError,
  assertSameSpend,
  bitcoinNetwork,
  createFundPsbt,
  finalizeFundPsbt,
  outputScript,
  pubkeyAt,
  satsForXof,
  selectCoins,
  signatureCoversInput,
  type FundInput,
  type PolicyKeys,
  type Role,
} from "@koinon/core";
import { appendAudit } from "./audit.js";
import type { BitcoinClient } from "./bitcoin.js";
import { withTx } from "./db.js";
import { fundById, fundKeys, type FundRow } from "./funds.js";
import type { RateSnapshot } from "./rate.js";

export interface RequestRow {
  id: string;
  fund_id: string;
  requester: string;
  recipient: string;
  purpose: string;
  amount_xof: string;
  amount_sats: string;
  rate_btc_eur: string;
  rate_btc_xof: string;
  rate_fetched_at: string;
  rate_stale: number;
  fee_sats: string;
  change_sats: string;
  psbt: string;
  inputs_json: string;
  path: "A" | "B";
  status: string;
  expires_at: string;
  created_at: string;
  broadcast_txid: string | null;
  fail_reason: string | null;
  reject_reason: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function createRequest(args: {
  db: DatabaseSync;
  fund: FundRow;
  role: Role;
  recipient: string;
  purpose: string;
  amountXof: bigint;
  path: "A" | "B";
  rate: RateSnapshot;
  requireFresh: boolean;
  tip: number;
  now: Date;
}): RequestRow {
  if (args.role === "K") {
    throw new KoinonError(ErrorCode.VALIDATION, "the assembly key cannot open a spend");
  }
  if (args.requireFresh && args.rate.stale) {
    throw new KoinonError(ErrorCode.RATE_STALE, "the btc/xof rate is stale");
  }
  if (!args.rate.btc_eur || !args.rate.btc_xof || !args.rate.fetched_at) {
    throw new KoinonError(ErrorCode.RATE_UNAVAILABLE, "no btc/xof rate is available");
  }
  let recipientScript: Uint8Array;
  try {
    recipientScript = outputScript(args.recipient, "regtest");
  } catch {
    throw new KoinonError(ErrorCode.VALIDATION, "invalid recipient address");
  }
  const amountSats = satsForXof(args.amountXof, args.rate.btc_eur);
  if (amountSats < 546n) {
    throw new KoinonError(ErrorCode.VALIDATION, "amount is below the dust limit");
  }
  const keys = fundKeys(args.fund);
  const matureAfter = args.path === "B" ? args.fund.csv_blocks : 1;
  const coins = unspent(args.db, args.fund.id, args.tip, matureAfter);
  const anyCoins = unspent(args.db, args.fund.id, args.tip, 1);
  if (sum(anyCoins) < amountSats && sum(coins) < amountSats) {
    throw new KoinonError(ErrorCode.INSUFFICIENT_FUNDS, "the fund cannot cover this amount and fee");
  }
  if (args.path === "B" && sum(coins) < amountSats) {
    throw new KoinonError(ErrorCode.TIMELOCK_NOT_MET, "no coin is old enough for the recovery path");
  }
  const selected = selectCoins({
    coins,
    amount: amountSats,
    feeCap: BigInt(args.fund.fee_cap_sats),
  });
  const outputs = [{ address: args.recipient, value: selected.recipient }];
  if (selected.change > 0n) {
    outputs.push({ address: args.fund.change_address, value: selected.change });
  }
  const inputs: FundInput[] = selected.inputs.map((coin) => ({
    txid: coin.txid,
    vout: coin.vout,
    value: coin.value,
    change: coin.change,
    index: coin.index,
  }));
  const psbt = createFundPsbt({
    network: "regtest",
    keys,
    inputs,
    outputs,
    mode: args.path === "B" ? "path-b" : "path-a",
  });
  // Touch the script so an unspendable address fails before we store the request.
  void recipientScript;
  const id = crypto.randomUUID();
  const createdAt = args.now.toISOString();
  const expiresAt = new Date(args.now.getTime() + DAY_MS).toISOString();
  withTx(args.db, () => {
    for (const input of inputs) {
      const reserved = args.db
        .prepare(
          "UPDATE utxos SET reserved_by = ? WHERE fund_id = ? AND txid = ? AND vout = ? AND spent_by IS NULL AND reserved_by IS NULL",
        )
        .run(id, args.fund.id, input.txid, input.vout);
      if (Number(reserved.changes) !== 1) {
        throw new KoinonError(ErrorCode.INSUFFICIENT_FUNDS, "a selected coin was reserved concurrently");
      }
    }
    args.db
      .prepare(
        `INSERT INTO requests (
          id, fund_id, requester, recipient, purpose, amount_xof, amount_sats, rate_btc_eur, rate_btc_xof,
          rate_fetched_at, rate_stale, fee_sats, change_sats, psbt, inputs_json, path, status, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      )
      .run(
        id,
        args.fund.id,
        args.role,
        args.recipient,
        args.purpose,
        args.amountXof.toString(),
        amountSats.toString(),
        args.rate.btc_eur,
        args.rate.btc_xof,
        args.rate.fetched_at,
        args.rate.stale ? 1 : 0,
        selected.fee.toString(),
        selected.change.toString(),
        psbt.toBase64(),
        storedInputs(inputs),
        args.path,
        expiresAt,
        createdAt,
      );
    appendAudit(args.db, args.fund.id, args.role, "request.create", id, {
      amount_xof: args.amountXof.toString(),
      amount_sats: amountSats.toString(),
      path: args.path,
      rate_stale: args.rate.stale,
    }, createdAt);
  });
  return requestById(args.db, id);
}

export function addSignature(args: {
  db: DatabaseSync;
  request: RequestRow;
  role: Role;
  psbtBase64: string;
  now: Date;
}): { status: string; approvals: number } {
  const fund = fundById(args.db, args.request.fund_id);
  assertOpen(args.request, args.now, args.db);
  if (args.request.status !== "pending" && args.request.status !== "approved") {
    throw new KoinonError(ErrorCode.VALIDATION, "this request is not open for signatures");
  }
  const existing = args.db
    .prepare("SELECT officer FROM approvals WHERE request_id = ? AND officer = ?")
    .get(args.request.id, args.role) as { officer: string } | undefined;
  if (existing) throw new KoinonError(ErrorCode.ALREADY_SIGNED, "this officer already signed");
  const keys = fundKeys(fund);
  const inputs = parseInputs(args.request.inputs_json);
  const stored = Psbt.fromBase64(args.request.psbt, { network: bitcoinNetwork("regtest") });
  let incoming: Psbt;
  try {
    incoming = Psbt.fromBase64(args.psbtBase64, { network: bitcoinNetwork("regtest") });
  } catch {
    throw new KoinonError(ErrorCode.VALIDATION, "invalid psbt");
  }
  assertSameSpend(stored, incoming);
  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index];
    if (!input) throw new KoinonError(ErrorCode.VALIDATION, "missing input");
    const expected = pubkeyAt(xpubOf(keys, args.role), input.change, input.index, "regtest");
    if (!signatureCoversInput(incoming, index, expected)) {
      throw new KoinonError(ErrorCode.SIG_INVALID, "signature does not match this officer and the locked transaction");
    }
  }
  stored.combine(incoming);
  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index];
    if (!input) continue;
    const expected = pubkeyAt(xpubOf(keys, args.role), input.change, input.index, "regtest");
    if (!signatureCoversInput(stored, index, expected)) {
      throw new KoinonError(ErrorCode.SIG_INVALID, "combined signature did not verify");
    }
  }
  const signedAt = args.now.toISOString();
  let status = args.request.status;
  withTx(args.db, () => {
    args.db.prepare("UPDATE requests SET psbt = ? WHERE id = ?").run(stored.toBase64(), args.request.id);
    args.db.prepare("INSERT INTO approvals (request_id, officer, signed_at) VALUES (?, ?, ?)").run(args.request.id, args.role, signedAt);
    const approvals = args.db.prepare("SELECT officer FROM approvals WHERE request_id = ?").all(args.request.id) as {
      officer: string;
    }[];
    status = approvalStatus(args.request.path, approvals.map((row) => row.officer));
    if (status !== args.request.status) {
      args.db.prepare("UPDATE requests SET status = ? WHERE id = ?").run(status, args.request.id);
    }
    appendAudit(args.db, fund.id, args.role, "request.sign", args.request.id, { status }, signedAt);
  });
  const count = (
    args.db.prepare("SELECT COUNT(*) AS n FROM approvals WHERE request_id = ?").get(args.request.id) as { n: number }
  ).n;
  return { status, approvals: count };
}

export async function broadcastRequest(args: {
  db: DatabaseSync;
  bitcoin: BitcoinClient;
  request: RequestRow;
  now: Date;
}): Promise<string> {
  assertOpen(args.request, args.now, args.db);
  if (args.request.status !== "approved") {
    throw new KoinonError(ErrorCode.VALIDATION, "the request is not fully signed");
  }
  const fund = fundById(args.db, args.request.fund_id);
  const keys = fundKeys(fund);
  const inputs = parseInputs(args.request.inputs_json);
  const psbt = Psbt.fromBase64(args.request.psbt, { network: bitcoinNetwork("regtest") });
  const hex = finalizeFundPsbt({
    psbt,
    keys,
    network: "regtest",
    mode: args.request.path === "B" ? "path-b" : "path-a",
    inputs,
  });
  try {
    const txid = await args.bitcoin.sendRawTransaction(hex);
    withTx(args.db, () => {
      args.db
        .prepare("UPDATE requests SET status = 'broadcast', broadcast_txid = ? WHERE id = ?")
        .run(txid, args.request.id);
      appendAudit(args.db, fund.id, "system", "request.broadcast", args.request.id, { txid }, args.now.toISOString());
    });
    return txid;
  } catch (error) {
    const message = error instanceof Error ? error.message : "broadcast failed";
    withTx(args.db, () => {
      release(args.db, args.request.id);
      args.db
        .prepare("UPDATE requests SET status = 'failed', fail_reason = ? WHERE id = ?")
        .run(message, args.request.id);
      appendAudit(args.db, fund.id, "system", "request.broadcast_failed", args.request.id, { failed: true }, args.now.toISOString());
    });
    const code = message.includes("non-BIP68-final") ? ErrorCode.TIMELOCK_NOT_MET : ErrorCode.SIG_INVALID;
    throw new KoinonError(code, message);
  }
}

export function rejectRequest(args: {
  db: DatabaseSync;
  request: RequestRow;
  role: Role;
  reason: string;
  now: Date;
}): void {
  assertOpen(args.request, args.now, args.db);
  if (args.request.status !== "pending" && args.request.status !== "approved") {
    throw new KoinonError(ErrorCode.VALIDATION, "this request can no longer be rejected");
  }
  const at = args.now.toISOString();
  withTx(args.db, () => {
    release(args.db, args.request.id);
    args.db
      .prepare("UPDATE requests SET status = 'rejected', reject_reason = ? WHERE id = ?")
      .run(args.reason, args.request.id);
    appendAudit(args.db, args.request.fund_id, args.role, "request.reject", args.request.id, { rejected: true }, at);
  });
}

export function requestById(db: DatabaseSync, id: string): RequestRow {
  const row = db.prepare("SELECT * FROM requests WHERE id = ?").get(id) as RequestRow | undefined;
  if (!row) throw new KoinonError(ErrorCode.NOT_FOUND, "request not found");
  return row;
}

function assertOpen(request: RequestRow, now: Date, db: DatabaseSync): void {
  if (request.status === "expired" || now.toISOString() > request.expires_at) {
    if (request.status === "pending" || request.status === "approved") {
      withTx(db, () => {
        release(db, request.id);
        db.prepare("UPDATE requests SET status = 'expired' WHERE id = ?").run(request.id);
        appendAudit(db, request.fund_id, "system", "request.expire", request.id, { expired: true }, now.toISOString());
      });
    }
    throw new KoinonError(ErrorCode.REQUEST_EXPIRED, "request expired");
  }
}

function release(db: DatabaseSync, requestId: string): void {
  db.prepare("UPDATE utxos SET reserved_by = NULL WHERE reserved_by = ? AND spent_by IS NULL").run(requestId);
}

function unspent(db: DatabaseSync, fundId: string, tip: number, minConfirmations: number) {
  const rows = db
    .prepare(
      "SELECT txid, vout, sats, change, idx, block_height FROM utxos WHERE fund_id = ? AND spent_by IS NULL AND reserved_by IS NULL",
    )
    .all(fundId) as {
    txid: string;
    vout: number;
    sats: string;
    change: number;
    idx: number;
    block_height: number;
  }[];
  return rows
    .filter((row) => tip - row.block_height + 1 >= minConfirmations)
    .map((row) => ({
      txid: row.txid,
      vout: row.vout,
      value: BigInt(row.sats),
      change: row.change === 1 ? (1 as const) : (0 as const),
      index: row.idx,
    }));
}

function sum(coins: { value: bigint }[]): bigint {
  return coins.reduce((total, coin) => total + coin.value, 0n);
}

function approvalStatus(path: "A" | "B", officers: string[]): string {
  const set = new Set(officers);
  if (path === "A") {
    const count = ["O1", "O2", "O3"].filter((role) => set.has(role)).length;
    return count >= 2 ? "approved" : "pending";
  }
  const officer = ["O1", "O2", "O3"].some((role) => set.has(role));
  return set.has("K") && officer ? "approved" : "pending";
}

function storedInputs(inputs: FundInput[]): string {
  return JSON.stringify(inputs.map((input) => ({ ...input, value: input.value.toString() })));
}

function parseInputs(json: string): FundInput[] {
  const rows = JSON.parse(json) as { txid: string; vout: number; value: string; change: 0 | 1; index: number }[];
  return rows.map((row) => ({ ...row, value: BigInt(row.value) }));
}

function xpubOf(keys: PolicyKeys, role: Role): string {
  if (role === "K") return keys.assembly.xpub;
  const officer = keys.officers.find((item) => item.role === role);
  if (!officer) throw new KoinonError(ErrorCode.VALIDATION, "unknown officer");
  return officer.xpub;
}
