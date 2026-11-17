import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export interface AuditRow {
  seq: number;
  prev_hash: string;
  hash: string;
  at: string;
  actor: string;
  action: string;
  request_id: string | null;
  detail: string;
}

const GENESIS = "0".repeat(64);

export function auditHash(row: Omit<AuditRow, "hash">): string {
  const body = [
    row.seq,
    row.prev_hash,
    row.at,
    row.actor,
    row.action,
    row.request_id ?? "",
    row.detail,
  ].join("|");
  return createHash("sha256").update(body).digest("hex");
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
    prev_hash: previous?.hash ?? GENESIS,
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
  let previous = GENESIS;
  for (const row of rows) {
    const expected = auditHash({ ...row, prev_hash: row.prev_hash });
    if (row.prev_hash !== previous || row.hash !== expected) {
      return { ok: false, seq: row.seq };
    }
    previous = row.hash;
  }
  return { ok: true, seq: null };
}
