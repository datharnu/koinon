/**
 * Unlock with a passkey. The WebAuthn PRF extension returns 32 bytes that only this passkey can
 * produce for this salt; they become the secret the keystore (PBKDF2 + AES-GCM) encrypts with.
 * Nothing about the passkey reaches the coordinator.
 *
 * Create asks only `prf: {}` so Safari 18 / iCloud and Android's password manager enable hmac-secret.
 * The 32 bytes come from a following `get()` with `eval` — Chrome may also return them at create.
 * Windows Hello has no hmac-secret: create succeeds, PRF does not, and the UI falls back to an 8-digit code.
 */

export type UnlockMethod = { method: "passkey"; credentialId: string; salt: string } | { method: "code" };

const UNLOCK_KEY = "koinon.unlock.v1";

export class PasskeyError extends Error {
  constructor(readonly code: "UNSUPPORTED" | "NO_PRF" | "CANCELLED" | "FAILED" | "HOST") {
    super(code);
  }
}

/** localhost is a valid passkey domain. A numeric address is a secure context, and Chrome still refuses it. */
export function passkeyHostOk(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.includes(":") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  return true;
}

export function readUnlock(): UnlockMethod | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(UNLOCK_KEY) ?? "null") as UnlockMethod | null;
    return parsed && (parsed.method === "passkey" || parsed.method === "code") ? parsed : null;
  } catch {
    return null;
  }
}

export function writeUnlock(method: UnlockMethod): void {
  localStorage.setItem(UNLOCK_KEY, JSON.stringify(method));
}

export function passkeyAvailable(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && typeof window.PublicKeyCredential === "function";
}

/** False when this browser reports it cannot do PRF (Windows Hello, old Safari). Unknown → true, and create() decides. */
export async function passkeyPrfOffered(): Promise<boolean> {
  if (!passkeyAvailable()) return false;
  const capsFn = (PublicKeyCredential as typeof PublicKeyCredential & { getClientCapabilities?: () => Promise<Record<string, boolean>> }).getClientCapabilities;
  if (typeof capsFn !== "function") return true;
  try {
    const caps = await capsFn.call(PublicKeyCredential);
    if (caps && Object.prototype.hasOwnProperty.call(caps, "extension:prf")) return caps["extension:prf"] === true;
  } catch {
    return true;
  }
  return true;
}

interface PrfOutput {
  prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } };
}

export async function createPasskey(label: string): Promise<{ secret: string; method: UnlockMethod }> {
  if (!passkeyAvailable()) throw new PasskeyError("UNSUPPORTED");
  const salt = crypto.getRandomValues(new Uint8Array(32));
  let credential: PublicKeyCredential | null;
  try {
    credential = (await navigator.credentials.create({
      publicKey: {
        rp: { name: "Koinon", id: window.location.hostname },
        user: { id: randomBuffer(16), name: label, displayName: label },
        challenge: randomBuffer(32),
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          residentKey: "required",
          requireResidentKey: true,
          userVerification: "required",
        },
        timeout: 90_000,
        // Empty object: associate hmac-secret. Do not eval here — Safari 18 and Android ignore or fail it.
        extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null;
  } catch (error) {
    throw mapError(error);
  }
  if (!credential) throw new PasskeyError("CANCELLED");
  const method: UnlockMethod = { method: "passkey", credentialId: toB64(new Uint8Array(credential.rawId)), salt: toB64(salt) };
  const prf = (credential.getClientExtensionResults() as PrfOutput).prf;
  if (prf?.results?.first) return { secret: toHex(new Uint8Array(prf.results.first)), method };
  // Windows Hello: create works, hmac-secret does not. Don't prompt a second time.
  if (prf?.enabled === false) throw new PasskeyError("NO_PRF");
  return { secret: toHex(await evaluate(method)), method };
}

export async function unlockWithPasskey(method: Extract<UnlockMethod, { method: "passkey" }>): Promise<string> {
  return toHex(await evaluate(method));
}

async function evaluate(method: Extract<UnlockMethod, { method: "passkey" }>): Promise<Uint8Array> {
  let assertion: PublicKeyCredential | null;
  try {
    assertion = (await navigator.credentials.get({
      publicKey: {
        rpId: window.location.hostname,
        challenge: randomBuffer(32),
        allowCredentials: [{ type: "public-key", id: fromB64(method.credentialId) }],
        userVerification: "required",
        timeout: 90_000,
        extensions: { prf: { eval: { first: fromB64(method.salt) } } } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null;
  } catch (error) {
    throw mapError(error);
  }
  if (!assertion) throw new PasskeyError("CANCELLED");
  const first = (assertion.getClientExtensionResults() as PrfOutput).prf?.results?.first;
  if (!first) throw new PasskeyError("NO_PRF");
  return new Uint8Array(first);
}

function mapError(error: unknown): PasskeyError {
  if (error instanceof PasskeyError) return error;
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError")) return new PasskeyError("CANCELLED");
  if (error instanceof DOMException && error.name === "NotSupportedError") return new PasskeyError("NO_PRF");
  if (error instanceof DOMException && error.name === "SecurityError") return new PasskeyError("HOST");
  return new PasskeyError("FAILED");
}

function randomBuffer(bytes: number): ArrayBuffer {
  return toBuffer(crypto.getRandomValues(new Uint8Array(bytes)));
}

function toBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toB64(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function fromB64(text: string): ArrayBuffer {
  const raw = atob(text);
  const out = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) out[index] = raw.charCodeAt(index);
  return toBuffer(out);
}
