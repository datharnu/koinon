import { accountSigner, authPayload, signAuth, type Role } from "@koinon/core";
import { request } from "./http";

export * from "./http";

/** Officer calls. The member pages use `request` in http.ts and do not load this file. */
export async function api<T = Record<string, unknown>>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  auth?: { role: Role; mnemonic: string },
): Promise<T> {
  const headers: Record<string, string> = {};
  if (auth) {
    const raw = body === undefined ? "" : JSON.stringify(body);
    headers.authorization = officerHeader(method, path, raw, auth.role, auth.mnemonic);
  }
  return request<T>(method, path, body, headers);
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
