import { auditDigest, verifyAuditChain, type AuditChainRow } from "@koinon/core/proof";
import type { DatabaseSync } from "node:sqlite";

export interface AuditRow extends AuditChainRow {}

export function auditHash(row: Omit<AuditRow, "hash">): string {
  return auditDigest(row);
}

export function appendAudit(
  db: DatabaseSync,
  fundId: string,
  actor: string,
  action: string,
  requestId: string | null,
  detail: Record<string, string | number | boolean | null>,
  at: string,
): void {
  const previous = db
    .prepare("SELECT seq, hash FROM audit WHERE fund_id = ? ORDER BY seq DESC LIMIT 1")
    .get(fundId) as { seq: number; hash: string } | undefined;
  const row: Omit<AuditRow, "hash"> = {
    seq: (previous?.seq ?? 0) + 1,
    prev_hash: previous?.hash ?? "0".repeat(64),
    at,
    actor,
    action,
    request_id: requestId,
    detail: JSON.stringify(detail),
  };
  const hash = auditHash(row);
  db.prepare(
    `INSERT INTO audit (fund_id, seq, prev_hash, hash, at, actor, action, request_id, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(fundId, row.seq, row.prev_hash, hash, row.at, row.actor, row.action, row.request_id, row.detail);
}

export function verifyAudit(rows: AuditRow[]): { ok: boolean; seq: number | null } {
  const checked = verifyAuditChain(rows);
  return { ok: checked.ok, seq: checked.seq };
}
