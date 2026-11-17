import { ErrorCode, KoinonError } from "./errors.js";

/** PBKDF2-SHA256 floor from the spec. A file that claims fewer rounds is refused. */
export const MIN_KEY_ITERATIONS = 310_000;

export interface EncryptedKey {
  v: 1;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export async function encryptKey(plaintext: Uint8Array, pin: string, iterations = MIN_KEY_ITERATIONS): Promise<EncryptedKey> {
  if (pin.length < 8) throw new KoinonError(ErrorCode.VALIDATION, "pin must be at least 8 characters");
  if (!Number.isInteger(iterations) || iterations < MIN_KEY_ITERATIONS) {
    throw new KoinonError(ErrorCode.VALIDATION, "key derivation is below the minimum");
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(pin, salt, iterations, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: bytes(iv) }, key, bytes(plaintext)));
  return {
    v: 1,
    kdf: "PBKDF2-SHA256",
    iterations,
    salt: Buffer.from(salt).toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
    ciphertext: Buffer.from(ciphertext).toString("base64"),
  };
}

export async function decryptKey(file: EncryptedKey, pin: string): Promise<Uint8Array> {
  if (file.v !== 1 || file.kdf !== "PBKDF2-SHA256" || !Number.isInteger(file.iterations) || file.iterations < MIN_KEY_ITERATIONS) {
    throw new KoinonError(ErrorCode.VALIDATION, "key file is not strong enough");
  }
  try {
    const key = await derive(pin, Buffer.from(file.salt, "base64"), file.iterations, ["decrypt"]);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes(Buffer.from(file.iv, "base64")) },
      key,
      bytes(Buffer.from(file.ciphertext, "base64")),
    );
    return new Uint8Array(plain);
  } catch (error) {
    if (error instanceof KoinonError) throw error;
    throw new KoinonError(ErrorCode.VALIDATION, "wrong pin");
  }
}

function derive(
  pin: string,
  salt: Uint8Array,
  iterations: number,
  usage: KeyUsage[],
): Promise<CryptoKey> {
  return crypto.subtle
    .importKey("raw", bytes(new TextEncoder().encode(pin)), "PBKDF2", false, ["deriveKey"])
    .then((base) =>
      crypto.subtle.deriveKey(
        { name: "PBKDF2", hash: "SHA-256", salt: bytes(salt), iterations },
        base,
        { name: "AES-GCM", length: 256 },
        false,
        usage,
      ),
    );
}

function bytes(value: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(value.byteLength);
  new Uint8Array(copy).set(value);
  return copy;
}
