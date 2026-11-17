import { accountSigner, authPayload, decryptKey, signAuth, type EncryptedKey, type Role } from "@koinon/core";
import { readFileSync } from "node:fs";
import { keyPath } from "./config.js";
import { line, type Lang } from "./text.js";

export interface Runtime {
  lang: Lang;
  pin?: string;
  coordinator: string;
  relay?: string;
  rpcUrl: string;
  rpcUser: string;
  rpcPassword: string;
  rpcWallet: string;
}

export async function api(ctx: Runtime, method: string, urlPath: string, body?: unknown, auth?: { role: Role; mnemonic: string }): Promise<Record<string, unknown>> {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (auth) headers.authorization = header(method, urlPath, raw, auth.role, auth.mnemonic);
  const response = await fetch(`${ctx.coordinator}${urlPath}`, {
    method,
    headers,
    body: body === undefined ? undefined : raw,
  });
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const code = typeof json.code === "string" ? json.code : "ERROR";
    const message = typeof json.message === "string" ? json.message : String(response.status);
    throw new Error(`${code}: ${message}`);
  }
  return json;
}

export async function openKey(ctx: Runtime, role: Role): Promise<{ mnemonic: string; nostrSecret: Uint8Array }> {
  const pin = ctx.pin;
  if (!pin || pin.length < 8) {
    throw new Error(line(ctx.lang, "PIN manquant. Passez --pin ou KOINON_PIN (8 caractères minimum).", "Missing PIN. Pass --pin or KOINON_PIN (at least 8 characters)."));
  }
  let file: EncryptedKey;
  try {
    file = JSON.parse(readFileSync(keyPath(role), "utf8")) as EncryptedKey;
  } catch {
    throw new Error(line(ctx.lang, "Fichier de clé introuvable.", "Key file not found."));
  }
  const plain = JSON.parse(new TextDecoder().decode(await decryptKey(file, pin))) as {
    mnemonic: string;
    nostrSecretHex: string;
  };
  return { mnemonic: plain.mnemonic, nostrSecret: Buffer.from(plain.nostrSecretHex, "hex") };
}

export async function rpc(ctx: Runtime, method: string, params: unknown[], wallet = false): Promise<unknown> {
  const url = wallet ? `${ctx.rpcUrl}/wallet/${encodeURIComponent(ctx.rpcWallet)}` : ctx.rpcUrl;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${Buffer.from(`${ctx.rpcUser}:${ctx.rpcPassword}`).toString("base64")}`,
    },
    body: JSON.stringify({ jsonrpc: "1.0", id: "koinon", method, params }),
  });
  const body = (await response.json()) as { result: unknown; error: { code: number; message: string } | null };
  if (body.error) throw new Error(`${method}: ${body.error.code} ${body.error.message}`);
  return body.result;
}

function header(method: string, urlPath: string, raw: string, role: Role, mnemonic: string): string {
  const timestamp = Date.now();
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const payload = authPayload({
    method,
    path: urlPath,
    timestamp,
    nonce,
    body: new TextEncoder().encode(raw),
  });
  const signature = signAuth(accountSigner(mnemonic, "regtest"), payload);
  return `Koinon ${role} ${timestamp} ${nonce} ${signature}`;
}

export function btcFromSats(sats: bigint): string {
  const whole = sats / 100_000_000n;
  const frac = (sats % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
  return `${whole.toString()}.${frac || "0"}`;
}
