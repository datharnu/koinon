import { decryptKey, encryptKey, type EncryptedKey, type Role } from "@koinon/core";

/**
 * What one browser keeps. Public config in the clear; each seed encrypted with the PIN
 * (PBKDF2-SHA256 310k + AES-256-GCM from @koinon/core). The PIN never leaves memory.
 *
 * The demo keeps all four keys in one browser so a judge can play every officer.
 * A real fund keeps one key per phone.
 */
export interface FundConfig {
  v: 1;
  fundId: string;
  name: string;
  csvBlocks: number;
  feeCapSats: string;
  officers: Record<"O1" | "O2" | "O3", { label: string; xpub: string; nostrPub: string }>;
  assembly: { label: string; xpub: string; nostrPub: string };
  vendorAddress: string;
  createdAt: string;
}

export interface Secret {
  mnemonic: string;
  nostrSecret: Uint8Array;
}

const CONFIG_KEY = "koinon.fund.v1";
const KEY_PREFIX = "koinon.key.v1.";
const MINE_KEY = "koinon.mine.v1.";

export function readConfig(): FundConfig | null {
  const raw = localStorage.getItem(CONFIG_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as FundConfig;
    return parsed.v === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function writeConfig(config: FundConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export async function storeSecret(role: Role, secret: Secret, pin: string): Promise<void> {
  const plain = new TextEncoder().encode(
    JSON.stringify({ mnemonic: secret.mnemonic, nostrSecretHex: toHex(secret.nostrSecret) }),
  );
  const sealed = await encryptKey(plain, pin);
  localStorage.setItem(KEY_PREFIX + role, JSON.stringify(sealed));
}

export async function openSecret(role: Role, pin: string): Promise<Secret> {
  const raw = localStorage.getItem(KEY_PREFIX + role);
  if (!raw) throw new Error("NO_KEY");
  const file = JSON.parse(raw) as EncryptedKey;
  const plain = JSON.parse(new TextDecoder().decode(await decryptKey(file, pin))) as { mnemonic: string; nostrSecretHex: string };
  return { mnemonic: plain.mnemonic, nostrSecret: fromHex(plain.nostrSecretHex) };
}

/** Request ids this browser opened, per role, so the requester can follow them. */
export function myRequests(role: Role): string[] {
  try {
    return JSON.parse(localStorage.getItem(MINE_KEY + role) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function rememberRequest(role: Role, id: string): void {
  const list = [id, ...myRequests(role).filter((item) => item !== id)].slice(0, 30);
  localStorage.setItem(MINE_KEY + role, JSON.stringify(list));
}

export function forgetFund(): void {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("koinon.") && key !== "koinon.theme" && key !== "koinon.lang") localStorage.removeItem(key);
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let index = 0; index < out.length; index += 1) out[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return out;
}
