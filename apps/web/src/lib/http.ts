export interface ApiError {
  code: string;
  message: string;
  status: number;
}

export class KoinonApiError extends Error implements ApiError {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** Same origin in every deployment: Vite proxies /v1 in dev, Caddy in production. */
export function coordinatorUrl(): string {
  return window.location.origin;
}

export async function request<T = Record<string, unknown>>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const raw = body === undefined ? undefined : JSON.stringify(body);
  if (body !== undefined) headers["content-type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(`${coordinatorUrl()}${path}`, { method, headers, body: raw });
  } catch {
    throw new KoinonApiError("UNKNOWN", "network", 0);
  }
  let json: Record<string, unknown> = {};
  try {
    json = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new KoinonApiError("UNKNOWN", "invalid response", response.status);
  }
  if (!response.ok) {
    const code = typeof json.code === "string" ? json.code : response.status === 404 ? "NOT_FOUND" : "UNKNOWN";
    throw new KoinonApiError(code, typeof json.message === "string" ? json.message : String(response.status), response.status);
  }
  return json as T;
}

export interface RateSnapshot {
  btc_eur: string | null;
  btc_xof: string | null;
  stale: boolean;
  age_seconds: number | null;
  fetched_at: string | null;
  peg: string;
  network: "regtest";
  regtest_sats_have_no_value: true;
}

export interface FundView {
  id: string;
  name: string;
  network: "regtest";
  regtest_sats_have_no_value: true;
  csv_blocks: number;
  fee_cap_sats: string;
  officers: { role: "O1" | "O2" | "O3"; label: string; xpub: string }[];
  assembly: { role: "K"; label: string; xpub: string };
  change_address: string;
  balance_sats: string;
  balance_xof: string | null;
  /** Sum of the franc amounts on the ledger rows. Null if any row has no franc value. */
  ledger_xof: string | null;
  chain_tip: number;
  rate: RateSnapshot;
}

export interface LedgerEntry {
  kind: "contribution" | "spend";
  txid: string;
  vout: number | null;
  index: number | null;
  indexes: number[];
  sats: string;
  xof_at_receipt: string | null;
  fee_sats: string | null;
  request_id: string | null;
  confirmations: number;
  seen_at: string;
}

export interface Member {
  index: number;
  pseudonym: string;
  address: string;
}

export type RequestStatus = "draft" | "pending" | "approved" | "broadcast" | "confirmed" | "rejected" | "expired" | "failed";

export interface RequestView {
  id: string;
  fund_id: string;
  requester: "O1" | "O2" | "O3" | "K";
  recipient: string;
  purpose: string;
  amount_xof: string;
  amount_sats: string;
  rate_btc_eur: string;
  rate_btc_xof: string;
  rate_stale: boolean;
  fee_sats: string | null;
  path: "A" | "B";
  status: RequestStatus;
  expires_at: string;
  created_at: string;
  broadcast_txid: string | null;
  approvals: { officer: string; signed_at: string }[];
  psbt: string;
}

export interface AuditEntry {
  seq: number;
  prev_hash: string;
  hash: string;
  at: string;
  actor: string;
  action: string;
  request_id: string | null;
  detail: string;
}

export interface TxProof {
  txid: string;
  hex: string;
  kind: "spend" | "contribution";
  confirmations: number | null;
  network: "regtest";
  regtest_sats_have_no_value: true;
}

export const endpoints = {
  health: () => request<{ ok: boolean; demo: boolean; bitcoind: boolean }>("GET", "/v1/health"),
  rate: () => request<RateSnapshot>("GET", "/v1/rate"),
  fund: (id: string) => request<FundView>("GET", `/v1/funds/${id}`),
  members: (id: string) => request<{ members: Member[] }>("GET", `/v1/funds/${id}/members`),
  ledger: (id: string, offset = 0) =>
    request<{ entries: LedgerEntry[]; next_offset: number | null }>("GET", `/v1/funds/${id}/ledger?limit=50&offset=${offset}`),
  request: (id: string) => request<RequestView>("GET", `/v1/requests/${id}`),
  audit: (id: string) => request<{ entries: AuditEntry[] }>("GET", `/v1/funds/${id}/audit`),
  auditVerify: (id: string) => request<{ ok: boolean; seq: number | null }>("GET", `/v1/funds/${id}/audit/verify`),
  proof: (id: string, txid: string) => request<TxProof>("GET", `/v1/funds/${id}/proof/${txid}`),
};
