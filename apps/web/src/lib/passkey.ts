/**
 * Unlock with a passkey. The WebAuthn PRF extension returns 32 bytes that only this passkey can
 * produce for this salt; they become the secret the keystore (PBKDF2 + AES-GCM) encrypts with.
 * Nothing about the passkey reaches the coordinator.
 *
 * Passkeys without PRF cannot derive a secret, so the app falls back to a 6-digit code.
 */
export type UnlockMethod = { method: "passkey"; credentialId: string; salt: string } | { method: "code" };

const UNLOCK_KEY = "koinon.unlock.v1";

export class PasskeyError extends Error {
  constructor(readonly code: "UNSUPPORTED" | "NO_PRF" | "CANCELLED" | "FAILED") {
    super(code);
  }
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
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: label, displayName: label },
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
        timeout: 90_000,
        extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null;
  } catch (error) {
    throw mapError(error);
  }
  if (!credential) throw new PasskeyError("CANCELLED");
  const output = credential.getClientExtensionResults() as PrfOutput;
  if (!output.prf?.enabled && !output.prf?.results?.first) throw new PasskeyError("NO_PRF");
  const method: UnlockMethod = { method: "passkey", credentialId: toB64(new Uint8Array(credential.rawId)), salt: toB64(salt) };
  const first = output.prf.results?.first ? new Uint8Array(output.prf.results.first) : await evaluate(method);
  return { secret: toHex(first), method };
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
        challenge: crypto.getRandomValues(new Uint8Array(32)),
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
  if (error instanceof DOMException && error.name === "NotSupportedError") return new PasskeyError("UNSUPPORTED");
  return new PasskeyError("FAILED");
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toB64(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function fromB64(text: string): Uint8Array<ArrayBuffer> {
  const raw = atob(text);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) out[index] = raw.charCodeAt(index);
  return out;
}
