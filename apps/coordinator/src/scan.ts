import { Block, type Transaction } from "bitcoinjs-lib";
import type { DatabaseSync } from "node:sqlite";
import { bytesToHex, xofForSats } from "@koinon/core";
import type { BitcoinClient } from "./bitcoin.js";
import type { RateSnapshot } from "./rate.js";

interface ScriptOwner {
  fundId: string;
  index: number;
  change: 0 | 1;
}

export async function scanChain(
  db: DatabaseSync,
  bitcoin: BitcoinClient,
  rate: RateSnapshot,
  now: Date,
): Promise<number> {
  const tip = await bitcoin.getBlockCount();
  const cursor = db.prepare("SELECT scanned_height, needs_rescan FROM chain_cursor WHERE id = 1").get() as {
    scanned_height: number;
    needs_rescan: number;
  };
  const start = cursor.needs_rescan ? 0 : cursor.scanned_height + 1;
  const scripts = loadScripts(db);
  for (let height = start; height <= tip; height += 1) {
    const hash = await bitcoin.getBlockHash(height);
    const hex = await bitcoin.getBlockHex(hash);
    const block = Block.fromHex(hex);
    for (const tx of block.transactions ?? []) {
      applyTransaction(db, tx, height, scripts, rate, now.toISOString());
    }
  }
  db.prepare("UPDATE chain_cursor SET scanned_height = ?, needs_rescan = 0 WHERE id = 1").run(tip);
  return tip;
}

export function markRescan(db: DatabaseSync): void {
  db.prepare("UPDATE chain_cursor SET needs_rescan = 1 WHERE id = 1").run();
}

function loadScripts(db: DatabaseSync): Map<string, ScriptOwner> {
  const scripts = new Map<string, ScriptOwner>();
  const funds = db.prepare("SELECT id, change_script FROM funds").all() as { id: string; change_script: string }[];
  for (const fund of funds) {
    scripts.set(fund.change_script, { fundId: fund.id, index: 0, change: 1 });
  }
  const members = db.prepare("SELECT fund_id, idx, script FROM members").all() as {
    fund_id: string;
    idx: number;
    script: string;
  }[];
  for (const member of members) {
    scripts.set(member.script, { fundId: member.fund_id, index: member.idx, change: 0 });
  }
  return scripts;
}

function applyTransaction(
  db: DatabaseSync,
  tx: Transaction,
  height: number,
  scripts: Map<string, ScriptOwner>,
  rate: RateSnapshot,
  seenAt: string,
): void {
  const txid = tx.getId();
  const consumed = new Map<string, bigint>();
  if (!tx.isCoinbase()) {
    for (const input of tx.ins) {
      const prev = bytesToHex(Uint8Array.from(input.hash).reverse());
      const rows = db
        .prepare("SELECT fund_id, sats FROM utxos WHERE txid = ? AND vout = ? AND spent_by IS NULL")
        .all(prev, input.index) as { fund_id: string; sats: string }[];
      for (const row of rows) {
        db.prepare(
          "UPDATE utxos SET spent_by = ?, spent_height = ? WHERE fund_id = ? AND txid = ? AND vout = ?",
        ).run(txid, height, row.fund_id, prev, input.index);
        consumed.set(row.fund_id, (consumed.get(row.fund_id) ?? 0n) + BigInt(row.sats));
      }
    }
  }

  tx.outs.forEach((output, vout) => {
    const owner = scripts.get(bytesToHex(output.script));
    if (!owner) return;
    const xof =
      owner.change === 0 && rate.btc_eur ? String(xofForSats(output.value, rate.btc_eur)) : null;
    db.prepare(
      `INSERT INTO utxos (
        fund_id, txid, vout, idx, change, sats, xof_at_receipt, block_height, seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (fund_id, txid, vout) DO NOTHING`,
    ).run(
      owner.fundId,
      txid,
      vout,
      owner.index,
      owner.change,
      output.value.toString(),
      xof,
      height,
      seenAt,
    );
  });

  const allOut = tx.outs.reduce((sum, output) => sum + output.value, 0n);
  const external = tx.outs.reduce((sum, output) => {
    return sum + (scripts.has(bytesToHex(output.script)) ? 0n : output.value);
  }, 0n);
  for (const [fundId, satsIn] of consumed) {
    const fee = satsIn >= allOut ? satsIn - allOut : 0n;
    const request = db.prepare("SELECT id FROM requests WHERE fund_id = ? AND broadcast_txid = ?").get(fundId, txid) as
      | { id: string }
      | undefined;
    db.prepare(
      `INSERT INTO spends (fund_id, txid, sats_in, sats_out, fee_sats, block_height, request_id, seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (fund_id, txid) DO NOTHING`,
    ).run(fundId, txid, satsIn.toString(), external.toString(), fee.toString(), height, request?.id ?? null, seenAt);
    db.prepare(
      "UPDATE requests SET status = 'confirmed' WHERE fund_id = ? AND broadcast_txid = ? AND status = 'broadcast'",
    ).run(fundId, txid);
  }
}
