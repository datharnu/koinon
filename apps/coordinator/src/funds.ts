import type { DatabaseSync } from "node:sqlite";
import {
  ACCOUNT_PATH,
  ErrorCode,
  KoinonError,
  type Account,
  type PolicyKeys,
  type Role,
} from "@koinon/core";

export interface FundRow {
  id: string;
  name: string;
  network: string;
  csv_blocks: number;
  fee_cap_sats: string;
  officer_label_o1: string;
  officer_xpub_o1: string;
  officer_label_o2: string;
  officer_xpub_o2: string;
  officer_label_o3: string;
  officer_xpub_o3: string;
  assembly_label: string;
  assembly_xpub: string;
  descriptor: string;
  change_address: string;
  change_script: string;
  created_at: string;
}

export function fundById(db: DatabaseSync, id: string): FundRow {
  const fund = db.prepare("SELECT * FROM funds WHERE id = ?").get(id) as FundRow | undefined;
  if (!fund) throw new KoinonError(ErrorCode.NOT_FOUND, "fund not found");
  return fund;
}

export function fundKeys(fund: FundRow): PolicyKeys {
  return {
    officers: [account("O1", fund.officer_xpub_o1), account("O2", fund.officer_xpub_o2), account("O3", fund.officer_xpub_o3)],
    assembly: account("K", fund.assembly_xpub),
    csvBlocks: fund.csv_blocks,
  };
}

export function xpubFor(fund: FundRow, role: Role): string {
  if (role === "O1") return fund.officer_xpub_o1;
  if (role === "O2") return fund.officer_xpub_o2;
  if (role === "O3") return fund.officer_xpub_o3;
  return fund.assembly_xpub;
}

export function balanceSats(db: DatabaseSync, fundId: string): bigint {
  const rows = db
    .prepare("SELECT sats FROM utxos WHERE fund_id = ? AND spent_by IS NULL")
    .all(fundId) as { sats: string }[];
  return rows.reduce((sum, row) => sum + BigInt(row.sats), 0n);
}

/**
 * Francs as the ledger rows show them: each due at receipt, less each spend's approved amount
 * (or, for a recovery with no request, the francs of the coins it consumed). Fees are sats only.
 * Null when any row has no franc value, so the client falls back to the sats.
 */
export function ledgerXof(db: DatabaseSync, fundId: string): bigint | null {
  const dues = db.prepare("SELECT xof_at_receipt FROM utxos WHERE fund_id = ? AND change = 0").all(fundId) as {
    xof_at_receipt: string | null;
  }[];
  let total = 0n;
  for (const row of dues) {
    if (row.xof_at_receipt === null) return null;
    total += BigInt(row.xof_at_receipt);
  }
  const spends = db
    .prepare("SELECT r.amount_xof, s.xof_at_spend FROM spends s LEFT JOIN requests r ON r.id = s.request_id WHERE s.fund_id = ?")
    .all(fundId) as { amount_xof: string | null; xof_at_spend: string | null }[];
  for (const row of spends) {
    const out = row.amount_xof ?? row.xof_at_spend;
    if (out === null) return null;
    total -= BigInt(out);
  }
  return total;
}

function account(role: Role, xpub: string): Account {
  return { role, xpub, path: ACCOUNT_PATH };
}
