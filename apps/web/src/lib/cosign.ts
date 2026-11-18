import type { EncryptedKey } from "@koinon/core";
import type { FundConfig } from "./vault";

/** Ciphertext for officer 2, plus the public fund config. The code is not in here. */
export interface CosignPayload {
  v: 1;
  config: FundConfig;
  key: EncryptedKey;
}

export function encodeCosign(payload: CosignPayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeCosign(fragment: string): CosignPayload | null {
  try {
    const padded = fragment.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const binary = atob(padded + pad);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as CosignPayload;
    if (parsed?.v !== 1 || parsed.config?.v !== 1 || !parsed.config.fundId || !parsed.config.officers?.O2?.xpub) return null;
    if (parsed.key?.v !== 1 || parsed.key.kdf !== "PBKDF2-SHA256" || !parsed.key.ciphertext) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function cosignLink(payload: CosignPayload, origin = window.location.origin): string {
  return `${origin}/cosign#${encodeCosign(payload)}`;
}
