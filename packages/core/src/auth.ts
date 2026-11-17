import { sha256 as nobleSha256 } from "@noble/hashes/sha2";
import type { BIP32Interface } from "bip32";
import * as ecc from "@bitcoinerlab/secp256k1";
import { bytesToHex, hexToBytes } from "./bytes.js";

export const AUTH_SKEW_MS = 5 * 60 * 1000;

export function sha256(bytes: Uint8Array): Uint8Array {
  return nobleSha256(bytes);
}

/** Bytes the officer signs. The server rebuilds this from the request it actually received. */
export function authPayload(args: {
  method: string;
  path: string;
  timestamp: number;
  nonce: string;
  body: Uint8Array;
}): Uint8Array {
  const text = [
    "koinon-auth.v1",
    args.method.toUpperCase(),
    args.path,
    String(args.timestamp),
    args.nonce,
    bytesToHex(sha256(args.body)),
  ].join("\n");
  return new TextEncoder().encode(text);
}

export function signAuth(signer: BIP32Interface, payload: Uint8Array): string {
  return bytesToHex(signer.sign(sha256(payload)));
}

export function verifyAuth(pubkey: Uint8Array, payload: Uint8Array, signatureHex: string): boolean {
  if (!/^[0-9a-fA-F]{128}$/.test(signatureHex)) return false;
  return ecc.verify(sha256(payload), pubkey, hexToBytes(signatureHex));
}
