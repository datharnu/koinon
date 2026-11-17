import * as bip39 from "bip39";
import type { BIP32Interface } from "bip32";
import { bip32 } from "./ecc.js";
import { bitcoinNetwork, type KoinonNetwork } from "./network.js";

/**
 * BIP48 native-segwit multisig account.
 * Coin type 1 is testnet. Regtest uses the same type, as specified.
 */
export const ACCOUNT_PATH = "m/48'/1'/0'/2'";

export const ROLES = ["O1", "O2", "O3", "K"] as const;
export type Role = (typeof ROLES)[number];

export interface Account {
  role: Role;
  /** Public only. Private keys stay on the holder that owns the seed. */
  xpub: string;
  path: typeof ACCOUNT_PATH;
}

export function mnemonicFromEntropy(entropy: Uint8Array): string {
  if (entropy.length !== 16 && entropy.length !== 20 && entropy.length !== 32) {
    throw new Error("BIP39 entropy must be 16, 20, or 32 bytes");
  }
  return bip39.entropyToMnemonic(Buffer.from(entropy));
}

export function accountFromMnemonic(mnemonic: string, role: Role, network: KoinonNetwork): Account {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error("invalid mnemonic");
  }
  const node = accountNode(mnemonic, network);
  return {
    role,
    xpub: node.neutered().toBase58(),
    path: ACCOUNT_PATH,
  };
}

/** External chain (0) is receive. Change chain (1) is the fund's own change. */
export function pubkeyAt(
  xpub: string,
  change: 0 | 1,
  index: number,
  network: KoinonNetwork,
): Uint8Array {
  assertIndex(index);
  const child = bip32.fromBase58(xpub, bitcoinNetwork(network)).derive(change).derive(index);
  return child.publicKey;
}

export function accountSigner(mnemonic: string, network: KoinonNetwork): BIP32Interface {
  const node = accountNode(mnemonic, network);
  if (!node.privateKey) {
    throw new Error("account key has no private key");
  }
  return node;
}

export function accountPubkey(xpub: string, network: KoinonNetwork): Uint8Array {
  return bip32.fromBase58(xpub, bitcoinNetwork(network)).publicKey;
}

export function signerAt(
  mnemonic: string,
  change: 0 | 1,
  index: number,
  network: KoinonNetwork,
): BIP32Interface {
  assertIndex(index);
  const child = accountNode(mnemonic, network).derive(change).derive(index);
  if (!child.privateKey) {
    throw new Error("derived key has no private key");
  }
  return child;
}

function accountNode(mnemonic: string, network: KoinonNetwork): BIP32Interface {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  return bip32.fromSeed(seed, bitcoinNetwork(network)).derivePath(ACCOUNT_PATH);
}

function assertIndex(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index > 0x7fffffff) {
    throw new Error("derivation index out of range");
  }
}
