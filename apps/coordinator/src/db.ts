import { DatabaseSync } from "node:sqlite";

export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  migrate(db);
  return db;
}

export function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS funds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      network TEXT NOT NULL,
      csv_blocks INTEGER NOT NULL,
      fee_cap_sats TEXT NOT NULL,
      officer_label_o1 TEXT NOT NULL,
      officer_xpub_o1 TEXT NOT NULL,
      officer_label_o2 TEXT NOT NULL,
      officer_xpub_o2 TEXT NOT NULL,
      officer_label_o3 TEXT NOT NULL,
      officer_xpub_o3 TEXT NOT NULL,
      assembly_label TEXT NOT NULL,
      assembly_xpub TEXT NOT NULL,
      descriptor TEXT NOT NULL,
      change_address TEXT NOT NULL,
      change_script TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS members (
      fund_id TEXT NOT NULL,
      idx INTEGER NOT NULL,
      pseudonym TEXT NOT NULL,
      address TEXT NOT NULL,
      script TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (fund_id, idx)
    );
    CREATE TABLE IF NOT EXISTS utxos (
      fund_id TEXT NOT NULL,
      txid TEXT NOT NULL,
      vout INTEGER NOT NULL,
      idx INTEGER NOT NULL,
      change INTEGER NOT NULL,
      sats TEXT NOT NULL,
      xof_at_receipt TEXT,
      block_height INTEGER NOT NULL,
      spent_by TEXT,
      spent_height INTEGER,
      reserved_by TEXT,
      seen_at TEXT NOT NULL,
      PRIMARY KEY (fund_id, txid, vout)
    );
    CREATE TABLE IF NOT EXISTS spends (
      fund_id TEXT NOT NULL,
      txid TEXT NOT NULL,
      sats_in TEXT NOT NULL,
      sats_out TEXT NOT NULL,
      fee_sats TEXT NOT NULL,
      block_height INTEGER NOT NULL,
      request_id TEXT,
      seen_at TEXT NOT NULL,
      PRIMARY KEY (fund_id, txid)
    );
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      fund_id TEXT NOT NULL,
      requester TEXT NOT NULL,
      recipient TEXT NOT NULL,
      purpose TEXT NOT NULL,
      amount_xof TEXT NOT NULL,
      amount_sats TEXT NOT NULL,
      rate_btc_eur TEXT NOT NULL,
      rate_btc_xof TEXT NOT NULL,
      rate_fetched_at TEXT NOT NULL,
      rate_stale INTEGER NOT NULL,
      fee_sats TEXT NOT NULL,
      change_sats TEXT NOT NULL,
      psbt TEXT NOT NULL,
      inputs_json TEXT NOT NULL,
      path TEXT NOT NULL,
      status TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      broadcast_txid TEXT,
      fail_reason TEXT,
      reject_reason TEXT
    );
    CREATE TABLE IF NOT EXISTS approvals (
      request_id TEXT NOT NULL,
      officer TEXT NOT NULL,
      signed_at TEXT NOT NULL,
      PRIMARY KEY (request_id, officer)
    );
    CREATE TABLE IF NOT EXISTS audit (
      fund_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      prev_hash TEXT NOT NULL,
      hash TEXT NOT NULL,
      at TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      request_id TEXT,
      detail TEXT NOT NULL,
      PRIMARY KEY (fund_id, seq)
    );
    CREATE TABLE IF NOT EXISTS chain_cursor (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      scanned_height INTEGER NOT NULL,
      needs_rescan INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS nonces (
      nonce TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );
  `);
  const cursor = db.prepare("SELECT id FROM chain_cursor WHERE id = 1").get();
  if (!cursor) {
    db.prepare("INSERT INTO chain_cursor (id, scanned_height, needs_rescan) VALUES (1, -1, 0)").run();
  }
}

export function withTx(db: DatabaseSync, run: () => void): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    run();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
