import { accountSigner, authPayload, signAuth, type Role } from "@koinon/core";

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

export async function api<T = Record<string, unknown>>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  auth?: { role: Role; mnemonic: string },
): Promise<T> {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (auth) headers.authorization = officerHeader(method, path, raw, auth.role, auth.mnemonic);
  let response: Response;
  try {
    response = await fetch(`${coordinatorUrl()}${path}`, { method, headers, body: body === undefined ? undefined : raw });
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
    throw new KoinonApiError(
      typeof json.code === "string" ? json.code : "UNKNOWN",
      typeof json.message === "string" ? json.message : String(response.status),
      response.status,
    );
  }
  return json as T;
}

function officerHeader(method: string, path: string, raw: string, role: Role, mnemonic: string): string {
  const timestamp = Date.now();
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const payload = authPayload({
    method,
    path: new URL(path, "http://koinon.local").pathname,
    timestamp,
    nonce,
    body: new TextEncoder().encode(raw),
  });
  return `Koinon ${role} ${timestamp} ${nonce} ${signAuth(accountSigner(mnemonic, "regtest"), payload)}`;
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
  balance_sats: string;
  balance_xof: string | null;
  chain_tip: number;
  rate: RateSnapshot;
}

export interface LedgerEntry {
  kind: "contribution" | "spend";
  txid: string;
  vout: number | null;
  index: number | null;
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
  requester: Role;
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

export const endpoints = {
  health: () => api<{ ok: boolean; demo: boolean; bitcoind: boolean }>("GET", "/v1/health"),
  rate: () => api<RateSnapshot>("GET", "/v1/rate"),
  fund: (id: string) => api<FundView>("GET", `/v1/funds/${id}`),
  members: (id: string) => api<{ members: Member[] }>("GET", `/v1/funds/${id}/members`),
  ledger: (id: string, offset = 0) =>
    api<{ entries: LedgerEntry[]; next_offset: number | null }>("GET", `/v1/funds/${id}/ledger?limit=50&offset=${offset}`),
  request: (id: string) => api<RequestView>("GET", `/v1/requests/${id}`),
  auditVerify: (id: string) => api<{ ok: boolean; seq: number | null }>("GET", `/v1/funds/${id}/audit/verify`),
};
