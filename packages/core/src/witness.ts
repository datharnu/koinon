import { bytesEqual } from "./bytes.js";
import { ErrorCode, KoinonError } from "./errors.js";

const EMPTY = new Uint8Array(0);

export interface PartialSignature {
  pubkey: Uint8Array;
  signature: Uint8Array;
}

export type WitnessMode = "path-a" | "single-sig-attack" | "path-b";

/**
 * Witness stack, bottom first. The last item is the witness script.
 * Path A is the 2-of-3 branch. A single real signature cannot satisfy it:
 * the attack witness still carries that one signature so bitcoind, not this
 * function, is what rejects it.
 * Path B dissatisfies the 2-of-3 with empty signatures (NULLFAIL), then
 * spends with the assembly key and one officer key. The input nSequence
 * must already be the CSV value; this function does not set it.
 */
export function buildWitness(args: {
  mode: WitnessMode;
  officerPubkeys: [Uint8Array, Uint8Array, Uint8Array];
  assemblyPubkey: Uint8Array;
  partials: PartialSignature[];
  witnessScript: Uint8Array;
}): Uint8Array[] {
  if (args.mode === "path-b") return witnessPathB(args);
  return witnessPathA(args);
}

function witnessPathA(args: {
  mode: WitnessMode;
  officerPubkeys: [Uint8Array, Uint8Array, Uint8Array];
  partials: PartialSignature[];
  witnessScript: Uint8Array;
}): Uint8Array[] {
  const signed = args.officerPubkeys
    .map((pubkey) => ({ pubkey, signature: findSig(args.partials, pubkey) }))
    .filter((item): item is { pubkey: Uint8Array; signature: Uint8Array } => item.signature !== undefined);

  if (args.mode === "single-sig-attack") {
    const only = signed[0];
    if (!only || signed.length !== 1) {
      throw new KoinonError(ErrorCode.VALIDATION, "single-sig attack needs exactly one officer signature");
    }
    // Top of stack is the real signature. The other slot is empty, so CHECKMULTISIG
    // fails and BIP146 NULLFAIL rejects the non-empty signature.
    return [EMPTY, EMPTY, only.signature, args.witnessScript];
  }

  const first = signed[0];
  const second = signed[1];
  if (!first || !second) {
    throw new KoinonError(ErrorCode.SIG_INVALID, "path A needs two officer signatures");
  }
  // 2026-11-17: the first version put the earlier key's signature on top.
  // bitcoind rejected that 2-of-3 with NULLFAIL, the same error as one signature.
  // CHECKMULTISIG pops the later key's signature first, so that signature is on top.
  return [EMPTY, first.signature, second.signature, args.witnessScript];
}

function witnessPathB(args: {
  officerPubkeys: [Uint8Array, Uint8Array, Uint8Array];
  assemblyPubkey: Uint8Array;
  partials: PartialSignature[];
  witnessScript: Uint8Array;
}): Uint8Array[] {
  const officer = args.officerPubkeys
    .map((pubkey) => findSig(args.partials, pubkey))
    .find((signature): signature is Uint8Array => signature !== undefined);
  const assembly = findSig(args.partials, args.assemblyPubkey);
  if (!officer || !assembly) {
    throw new KoinonError(ErrorCode.SIG_INVALID, "path B needs the assembly signature and one officer signature");
  }
  // Bottom to top: inner dummy, officer sig, assembly sig, outer dummy, two empty outer sigs.
  return [EMPTY, officer, assembly, EMPTY, EMPTY, EMPTY, args.witnessScript];
}

export function encodeWitness(stack: Uint8Array[]): Uint8Array {
  const parts: number[] = [];
  writeVarInt(parts, stack.length);
  for (const item of stack) {
    writeVarInt(parts, item.length);
    for (const byte of item) parts.push(byte);
  }
  return Uint8Array.from(parts);
}

function findSig(partials: PartialSignature[], pubkey: Uint8Array): Uint8Array | undefined {
  return partials.find((partial) => bytesEqual(partial.pubkey, pubkey))?.signature;
}

function writeVarInt(out: number[], value: number): void {
  if (value < 0xfd) {
    out.push(value);
    return;
  }
  if (value <= 0xffff) {
    out.push(0xfd, value & 0xff, (value >> 8) & 0xff);
    return;
  }
  throw new KoinonError(ErrorCode.VALIDATION, "witness element too large");
}
