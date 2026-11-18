/**
 * What a member's phone can check without bitcoinjs, miniscript, or a WASM secp.
 * SHA-256 is @noble/hashes. BIP32 and ECDSA are @noble/curves via @scure/bip32.
 * The script bytes are the shape documented in docs/POLICY.md. packages/core tests
 * compare them to the miniscript compiler. This file does not import that compiler.
 */
import { bech32 } from "@scure/base";
import { HDKey } from "@scure/bip32";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2";

export const AUDIT_GENESIS = "0".repeat(64);
/** Path A disables BIP68 and signals RBF. The same constant as PATH_A_SEQUENCE. */
const PATH_A_SEQUENCE = 0xfffffffe;
const SIGHASH_ALL = 1;

export type ProofRole = "O1" | "O2" | "O3" | "K";

export interface Constitution {
  /** Xpubs in officer order O1, O2, O3. Not sorted. */
  officers: [string, string, string];
  assembly: string;
  csvBlocks: number;
}

export interface AuditChainRow {
  seq: number;
  prev_hash: string;
  hash: string;
  at: string;
  actor: string;
  action: string;
  request_id: string | null;
  detail: string;
}

export interface FundXpubs extends Constitution {}

export interface DerivedScript {
  change: 0 | 1;
  index: number;
  address: string;
  script: Uint8Array;
  pubkeys: { role: ProofRole; pubkey: Uint8Array }[];
}

export interface OutputView {
  sats: string;
  /** member: a dues address. change: the fund's change. external: leaves the fund. */
  role: "member" | "change" | "external";
  index: number | null;
}

export interface InputView {
  txid: string;
  vout: number;
  sequence: number;
  valueSats: string | null;
  scriptMatch: boolean;
  /** True only when the parent output's script commits to this witness script. */
  outputCommit: boolean;
  path: "A" | "B" | "unproven";
  signers: ProofRole[];
  signaturesChecked: boolean;
  signaturesOk: boolean;
}

export interface Inspection {
  txid: string;
  direction: "spend" | "contribution" | "unrelated";
  ok: boolean;
  path: "A" | "B" | "unproven";
  signers: ProofRole[];
  inputs: InputView[];
  outputs: OutputView[];
  feeSats: string | null;
  /** Why ok is false, or the limit of a partial check. Empty when the spend fully verified. */
  reason: string | null;
}

export function constitutionPreimage(input: Constitution): string {
  return ["koinon-constitution.v1", input.officers[0], input.officers[1], input.officers[2], input.assembly, String(input.csvBlocks)].join("\n");
}

/** Fingerprint of the four xpubs and the CSV delay. Labels are not included. */
export function constitutionHash(input: Constitution): string {
  return bytesToHex(sha256(utf8(constitutionPreimage(input))));
}

export function auditDigest(row: Omit<AuditChainRow, "hash">): string {
  const body = [row.seq, row.prev_hash, row.at, row.actor, row.action, row.request_id ?? "", row.detail].join("|");
  return bytesToHex(sha256(utf8(body)));
}

export function verifyAuditChain(rows: AuditChainRow[]): { ok: boolean; seq: number | null; checked: number; total: number } {
  let previous = AUDIT_GENESIS;
  let checked = 0;
  for (const row of rows) {
    const expected = auditDigest(row);
    if (row.prev_hash !== previous || row.hash !== expected) {
      return { ok: false, seq: row.seq, checked, total: rows.length };
    }
    previous = row.hash;
    checked += 1;
  }
  return { ok: true, seq: null, checked, total: rows.length };
}

/** bitcoinjs `networks.regtest` uses the testnet BIP32 version bytes, including on regtest. */
const REGTEST_BIP32 = { private: 0x04358394, public: 0x043587cf };

export function pubkeyAtXpub(xpub: string, change: 0 | 1, index: number): Uint8Array {
  if (!Number.isInteger(index) || index < 0 || index > 0x7fffffff) throw new Error("derivation index out of range");
  const child = HDKey.fromExtendedKey(xpub, REGTEST_BIP32).deriveChild(change).deriveChild(index);
  if (!child.publicKey || child.publicKey.length !== 33) throw new Error("xpub did not yield a compressed key");
  return child.publicKey;
}

/** P2WSH address, regtest bech32. The program is SHA-256 of the witness script. */
export function p2wshAddress(witnessScript: Uint8Array): string {
  const words = bech32.toWords(sha256(witnessScript));
  return bech32.encode("bcrt", [0, ...words], 1023);
}

/**
 * Witness script bytes for 2-of-3 or (assembly + 1 officer after CSV).
 * Same layout as the miniscript compiler for this policy. The compiler remains
 * the source used when building a spend. This copy exists so a phone can hash
 * the script without loading that compiler.
 */
export function policyWitnessScript(officers: [Uint8Array, Uint8Array, Uint8Array], assembly: Uint8Array, csvBlocks: number): Uint8Array {
  if (!Number.isInteger(csvBlocks) || csvBlocks < 1 || csvBlocks > 0xffff) throw new Error("csv blocks out of range");
  return concat([
    Uint8Array.of(0x52),
    pushKey(officers[0]),
    pushKey(officers[1]),
    pushKey(officers[2]),
    Uint8Array.of(0x53, 0xae, 0x73, 0x64),
    pushKey(assembly),
    Uint8Array.of(0xad, 0x51),
    pushKey(officers[0]),
    pushKey(officers[1]),
    pushKey(officers[2]),
    Uint8Array.of(0x53, 0xaf),
    csvPush(csvBlocks),
    Uint8Array.of(0xb2, 0x68),
  ]);
}

export function deriveFundScript(keys: FundXpubs, change: 0 | 1, index: number): DerivedScript {
  const roles: ProofRole[] = ["O1", "O2", "O3", "K"];
  const xpubs = [keys.officers[0], keys.officers[1], keys.officers[2], keys.assembly];
  const pubkeys = roles.map((role, position) => {
    const xpub = xpubs[position];
    if (!xpub) throw new Error("missing xpub");
    return { role, pubkey: pubkeyAtXpub(xpub, change, index) };
  });
  const o1 = pubkeys[0]?.pubkey;
  const o2 = pubkeys[1]?.pubkey;
  const o3 = pubkeys[2]?.pubkey;
  const assembly = pubkeys[3]?.pubkey;
  if (!o1 || !o2 || !o3 || !assembly) throw new Error("missing derived key");
  const script = policyWitnessScript([o1, o2, o3], assembly, keys.csvBlocks);
  return { change, index, address: p2wshAddress(script), script, pubkeys };
}

export function checkAddresses(
  keys: FundXpubs,
  members: { index: number; address: string }[],
  changeAddress: string,
): { memberMatches: number; members: number; badIndexes: number[]; changeOk: boolean } {
  const badIndexes: number[] = [];
  let memberMatches = 0;
  for (const member of members) {
    const derived = deriveFundScript(keys, 0, member.index);
    if (derived.address === member.address) memberMatches += 1;
    else badIndexes.push(member.index);
  }
  const change = deriveFundScript(keys, 1, 0);
  return { memberMatches, members: members.length, badIndexes, changeOk: change.address === changeAddress };
}

interface DecodedInput {
  txidBytes: Uint8Array;
  txid: string;
  vout: number;
  sequence: number;
  witness: Uint8Array[];
}

interface DecodedTx {
  version: number;
  locktime: number;
  inputs: DecodedInput[];
  outputs: { value: bigint; script: Uint8Array }[];
}

export function inspectTransaction(args: { hex: string; keys: FundXpubs; indexes: number[]; parents?: { txid: string; hex: string }[] }): Inspection {
  const tx = decodeTransaction(args.hex);
  const txid = transactionId(tx);
  const catalog = scriptCatalog(args.keys, args.indexes);
  const parents = new Map<string, DecodedTx>();
  for (const parent of args.parents ?? []) {
    try {
      const decoded = decodeTransaction(parent.hex);
      if (transactionId(decoded) === parent.txid.toLowerCase()) parents.set(parent.txid.toLowerCase(), decoded);
    } catch {
      // A parent the phone cannot read is a missing value, not a passed check.
    }
  }
  const inputs = tx.inputs.map((input) => inspectInput(input, tx, args.keys, catalog, parents.get(input.txid)));
  const outputs = tx.outputs.map((output) => classifyOutput(output, catalog));
  const spends = inputs.filter((input) => input.scriptMatch);
  const paysIn = outputs.some((output) => output.role !== "external");
  const direction: Inspection["direction"] = spends.length > 0 ? "spend" : paysIn ? "contribution" : "unrelated";
  const fee = feeOf(inputs, tx.outputs);
  if (direction === "contribution") {
    return {
      txid,
      direction,
      ok: paysIn,
      path: "unproven",
      signers: [],
      inputs,
      outputs,
      feeSats: fee,
      reason: "A payment into the fund has no officer signature. This phone checked that an output pays a script derived from the fund keys.",
    };
  }
  if (direction === "unrelated") {
    return {
      txid,
      direction,
      ok: false,
      path: "unproven",
      signers: [],
      inputs,
      outputs,
      feeSats: fee,
      reason: "No input or output matches a script derived from these keys.",
    };
  }
  const proven = spends.filter((input) => input.signaturesOk && input.path !== "unproven" && input.outputCommit);
  const signers = proven[0]?.signers ?? spends[0]?.signers ?? [];
  const path = proven.length === spends.length && proven.length > 0 ? (proven[0]?.path ?? "unproven") : "unproven";
  const same =
    proven.length > 0 &&
    proven.every((input) => input.path === path && input.signers.join() === signers.join());
  let reason: string | null = null;
  if (spends.some((input) => !input.scriptMatch)) {
    reason = "An input does not spend this fund's script.";
  } else if (spends.some((input) => !input.signaturesChecked)) {
    reason = "The spent output's value was not in a parent transaction this phone could read, so the signatures were not checked.";
  } else if (spends.some((input) => !input.outputCommit)) {
    reason = "The output being spent does not commit to this witness script.";
  } else if (spends.some((input) => !input.signaturesOk)) {
    reason = "A signature in the witness did not verify against the fund keys.";
  } else if (!same || path === "unproven") {
    reason = "The signatures verify, but they are not a 2-of-3 or a recovery after the fund's delay.";
  }
  return {
    txid,
    direction,
    ok: reason === null,
    path: reason === null ? path : "unproven",
    signers: reason === null ? signers : spends[0]?.signers ?? [],
    inputs,
    outputs,
    feeSats: fee,
    reason,
  };
}

function inspectInput(
  input: DecodedInput,
  tx: DecodedTx,
  keys: FundXpubs,
  catalog: Map<string, DerivedScript>,
  parent: DecodedTx | undefined,
): InputView {
  const script = input.witness.length > 0 ? input.witness[input.witness.length - 1] : undefined;
  const derived = script && script.length > 0 ? catalog.get(bytesToHex(script)) : undefined;
  const parentOut = parent?.outputs[input.vout];
  const value = parentOut ? parentOut.value : null;
  const outputCommit = Boolean(script && parentOut && bytesEqual(parentOut.script, p2wshScript(script)));
  const base = {
    txid: input.txid,
    vout: input.vout,
    sequence: input.sequence,
    valueSats: value === null ? null : value.toString(),
    scriptMatch: Boolean(derived),
    outputCommit,
  };
  if (!script || !derived) {
    return { ...base, path: "unproven", signers: [], signaturesChecked: false, signaturesOk: false };
  }
  if (value === null) {
    return { ...base, path: "unproven", signers: [], signaturesChecked: false, signaturesOk: false };
  }
  const sighash = bip143Sighash(tx, input, script, value);
  const signers: ProofRole[] = [];
  let signaturesOk = true;
  let saw = false;
  for (const item of input.witness.slice(0, -1)) {
    if (item.length === 0) continue;
    saw = true;
    const role = derived.pubkeys.find((key) => verifyBitcoinSignature(item, sighash, key.pubkey))?.role;
    if (!role) signaturesOk = false;
    else if (!signers.includes(role)) signers.push(role);
  }
  if (!saw) signaturesOk = false;
  const officers = signers.filter((role) => role !== "K");
  let path: InputView["path"] = "unproven";
  if (signaturesOk && officers.length === 2 && !signers.includes("K") && input.sequence === PATH_A_SEQUENCE) path = "A";
  if (signaturesOk && officers.length === 1 && signers.includes("K") && input.sequence === keys.csvBlocks) path = "B";
  const ordered = (["O1", "O2", "O3", "K"] as const).filter((role) => signers.includes(role));
  return { ...base, path, signers: ordered, signaturesChecked: true, signaturesOk };
}

function classifyOutput(output: { value: bigint; script: Uint8Array }, catalog: Map<string, DerivedScript>): OutputView {
  for (const derived of catalog.values()) {
    if (bytesEqual(p2wshScript(derived.script), output.script)) {
      return {
        sats: output.value.toString(),
        role: derived.change === 1 ? "change" : "member",
        index: derived.change === 1 ? null : derived.index,
      };
    }
  }
  return { sats: output.value.toString(), role: "external", index: null };
}

function scriptCatalog(keys: FundXpubs, indexes: number[]): Map<string, DerivedScript> {
  const catalog = new Map<string, DerivedScript>();
  const add = (change: 0 | 1, index: number) => {
    const derived = deriveFundScript(keys, change, index);
    catalog.set(bytesToHex(derived.script), derived);
  };
  for (const index of indexes) add(0, index);
  add(1, 0);
  return catalog;
}

function feeOf(inputs: InputView[], outputs: { value: bigint }[]): string | null {
  if (inputs.length === 0 || inputs.some((input) => input.valueSats === null)) return null;
  let valueIn = 0n;
  for (const input of inputs) valueIn += BigInt(input.valueSats ?? "0");
  let valueOut = 0n;
  for (const output of outputs) valueOut += output.value;
  if (valueIn < valueOut) return null;
  return (valueIn - valueOut).toString();
}

function bip143Sighash(tx: DecodedTx, input: DecodedInput, witnessScript: Uint8Array, value: bigint): Uint8Array {
  const prevouts = concat(tx.inputs.map((item) => concat([item.txidBytes, u32le(item.vout)])));
  const sequences = concat(tx.inputs.map((item) => u32le(item.sequence)));
  const outputs = concat(tx.outputs.map((item) => concat([u64le(item.value), pushScript(item.script)])));
  const preimage = concat([
    u32le(tx.version),
    hash256(prevouts),
    hash256(sequences),
    input.txidBytes,
    u32le(input.vout),
    pushScript(witnessScript),
    u64le(value),
    u32le(input.sequence),
    hash256(outputs),
    u32le(tx.locktime),
    u32le(SIGHASH_ALL),
  ]);
  return hash256(preimage);
}

function verifyBitcoinSignature(signatureWithType: Uint8Array, sighash: Uint8Array, pubkey: Uint8Array): boolean {
  if (signatureWithType.length < 9) return false;
  if (signatureWithType[signatureWithType.length - 1] !== SIGHASH_ALL) return false;
  try {
    // prehash: false — the BIP143 sighash is already SHA-256. lowS matches BIP146.
    return secp256k1.verify(signatureWithType.slice(0, -1), sighash, pubkey, {
      prehash: false,
      lowS: true,
      format: "der",
    });
  } catch {
    return false;
  }
}

function p2wshScript(witnessScript: Uint8Array): Uint8Array {
  const program = sha256(witnessScript);
  const out = new Uint8Array(2 + program.length);
  out[0] = 0x00;
  out[1] = program.length;
  out.set(program, 2);
  return out;
}

function decodeTransaction(hex: string): DecodedTx {
  const bytes = hexToBytes(hex);
  let offset = 0;
  const version = readU32(bytes, offset);
  offset += 4;
  let segwit = false;
  if (bytes[offset] === 0) {
    segwit = true;
    offset += 2;
  }
  const vin = readVarint(bytes, offset);
  offset = vin.offset;
  const inputs: DecodedInput[] = [];
  for (let index = 0; index < vin.value; index += 1) {
    const txidBytes = bytes.slice(offset, offset + 32);
    offset += 32;
    const vout = readU32(bytes, offset);
    offset += 4;
    const script = readVarint(bytes, offset);
    offset = script.offset + script.value;
    const sequence = readU32(bytes, offset);
    offset += 4;
    inputs.push({ txidBytes, txid: bytesToHex(reversed(txidBytes)), vout, sequence, witness: [] });
  }
  const vout = readVarint(bytes, offset);
  offset = vout.offset;
  const outputs: { value: bigint; script: Uint8Array }[] = [];
  for (let index = 0; index < vout.value; index += 1) {
    const value = readU64(bytes, offset);
    offset += 8;
    const script = readVarint(bytes, offset);
    offset = script.offset;
    outputs.push({ value, script: bytes.slice(offset, offset + script.value) });
    offset += script.value;
  }
  if (segwit) {
    for (const input of inputs) {
      const count = readVarint(bytes, offset);
      offset = count.offset;
      const stack: Uint8Array[] = [];
      for (let index = 0; index < count.value; index += 1) {
        const item = readVarint(bytes, offset);
        offset = item.offset;
        stack.push(bytes.slice(offset, offset + item.value));
        offset += item.value;
      }
      input.witness = stack;
    }
  }
  const locktime = readU32(bytes, offset);
  offset += 4;
  if (offset !== bytes.length) throw new Error("transaction has trailing bytes");
  return { version, locktime, inputs, outputs };
}

function transactionId(tx: DecodedTx): string {
  const body = concat([
    u32le(tx.version),
    varint(tx.inputs.length),
    concat(tx.inputs.map((input) => concat([input.txidBytes, u32le(input.vout), varint(0), u32le(input.sequence)]))),
    varint(tx.outputs.length),
    concat(tx.outputs.map((output) => concat([u64le(output.value), pushScript(output.script)]))),
    u32le(tx.locktime),
  ]);
  return bytesToHex(reversed(hash256(body)));
}

function pushKey(key: Uint8Array): Uint8Array {
  if (key.length !== 33) throw new Error("officer keys are compressed");
  const out = new Uint8Array(34);
  out[0] = 33;
  out.set(key, 1);
  return out;
}

/** 1..16 are the small-number opcodes. Above that, a minimally encoded script number. */
function csvPush(blocks: number): Uint8Array {
  if (blocks >= 1 && blocks <= 16) return Uint8Array.of(0x50 + blocks);
  const encoded = scriptNumber(blocks);
  const out = new Uint8Array(1 + encoded.length);
  out[0] = encoded.length;
  out.set(encoded, 1);
  return out;
}

function scriptNumber(value: number): Uint8Array {
  const bytes: number[] = [];
  let rest = value;
  while (rest > 0) {
    bytes.push(rest & 0xff);
    rest >>= 8;
  }
  const last = bytes[bytes.length - 1] ?? 0;
  if (last & 0x80) bytes.push(0x00);
  return Uint8Array.from(bytes);
}

function pushScript(script: Uint8Array): Uint8Array {
  return concat([varint(script.length), script]);
}

function varint(value: number): Uint8Array {
  if (value < 0xfd) return Uint8Array.of(value);
  if (value <= 0xffff) return Uint8Array.of(0xfd, value & 0xff, (value >> 8) & 0xff);
  throw new Error("varint too large");
}

function readVarint(bytes: Uint8Array, offset: number): { value: number; offset: number } {
  const first = bytes[offset];
  if (first === undefined) throw new Error("truncated transaction");
  if (first < 0xfd) return { value: first, offset: offset + 1 };
  if (first === 0xfd) return { value: readU16(bytes, offset + 1), offset: offset + 3 };
  throw new Error("varint too large");
}

function readU16(bytes: Uint8Array, offset: number): number {
  const view = viewAt(bytes, offset, 2);
  return view.getUint16(0, true);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return viewAt(bytes, offset, 4).getUint32(0, true);
}

function readU64(bytes: Uint8Array, offset: number): bigint {
  return viewAt(bytes, offset, 8).getBigUint64(0, true);
}

function viewAt(bytes: Uint8Array, offset: number, size: number): DataView {
  if (offset + size > bytes.length) throw new Error("truncated transaction");
  return new DataView(bytes.buffer, bytes.byteOffset + offset, size);
}

function u32le(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value >>> 0, true);
  return out;
}

function u64le(value: bigint): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, value, true);
  return out;
}

function hash256(bytes: Uint8Array): Uint8Array {
  return sha256(sha256(bytes));
}

function reversed(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(bytes).reverse();
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function concat(parts: Uint8Array[]): Uint8Array {
  let length = 0;
  for (const part of parts) length += part.length;
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) throw new Error("invalid hex");
  const out = new Uint8Array(hex.length / 2);
  for (let index = 0; index < out.length; index += 1) out[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return out;
}
