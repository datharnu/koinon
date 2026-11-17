import * as ecc from "@bitcoinerlab/secp256k1";
import { address, payments, Psbt, script } from "bitcoinjs-lib";
import type { BIP32Interface } from "bip32";
import { bytesEqual, bytesToHex } from "./bytes.js";
import { ErrorCode, KoinonError } from "./errors.js";
import { bitcoinNetwork, type KoinonNetwork } from "./network.js";
import { pubkeyAt, signerAt } from "./keys.js";
import type { CompiledPolicy, PolicyKeys } from "./policy.js";
import { assertSameScript, compileFundPolicy } from "./policy.js";
import { buildWitness, encodeWitness, type WitnessMode } from "./witness.js";

/** Path A is spendable immediately. 0xfffffffe enables RBF and disables BIP68 on this input. */
export const PATH_A_SEQUENCE = 0xfffffffe;

export interface SpendOutput {
  address: string;
  value: bigint;
}

export interface SpendInput {
  txid: string;
  vout: number;
  value: bigint;
}

export interface FundInput {
  txid: string;
  vout: number;
  value: bigint;
  change: 0 | 1;
  index: number;
}

export function createSpendPsbt(args: {
  network: KoinonNetwork;
  policy: CompiledPolicy;
  input: SpendInput;
  outputs: SpendOutput[];
  mode: WitnessMode;
}): Psbt {
  if (args.outputs.length === 0) {
    throw new KoinonError(ErrorCode.VALIDATION, "a spend needs at least one output");
  }
  const sequence = args.mode === "path-b" ? args.policy.csvBlocks : PATH_A_SEQUENCE;
  const psbt = new Psbt({ network: bitcoinNetwork(args.network) });
  psbt.setMaximumFeeRate(100_000);
  psbt.addInput({
    hash: args.input.txid,
    index: args.input.vout,
    sequence,
    witnessUtxo: {
      script: args.policy.scriptPubKey,
      value: args.input.value,
    },
    witnessScript: args.policy.script,
  });
  for (const output of args.outputs) {
    psbt.addOutput({
      address: output.address,
      value: output.value,
    });
  }
  return psbt;
}

export function signSpend(psbt: Psbt, signer: BIP32Interface): Psbt {
  psbt.signInput(0, signer);
  return psbt;
}

export function finalizeSpend(args: {
  psbt: Psbt;
  policy: CompiledPolicy;
  keys: PolicyKeys;
  network: KoinonNetwork;
  mode: WitnessMode;
}): string {
  finalizeInputWithPolicy(args.psbt, 0, args.policy, args.keys, args.network, args.mode);
  return args.psbt.extractTransaction(true).toHex();
}

export function createFundPsbt(args: {
  network: KoinonNetwork;
  keys: PolicyKeys;
  inputs: FundInput[];
  outputs: SpendOutput[];
  mode: WitnessMode;
}): Psbt {
  if (args.inputs.length === 0) {
    throw new KoinonError(ErrorCode.VALIDATION, "a spend needs an input");
  }
  if (args.outputs.length === 0) {
    throw new KoinonError(ErrorCode.VALIDATION, "a spend needs at least one output");
  }
  const sequence = args.mode === "path-b" ? args.keys.csvBlocks : PATH_A_SEQUENCE;
  const psbt = new Psbt({ network: bitcoinNetwork(args.network) });
  psbt.setMaximumFeeRate(100_000);
  for (const input of args.inputs) {
    const policy = compileFundPolicy(args.keys, input.index, args.network, input.change);
    psbt.addInput({
      hash: input.txid,
      index: input.vout,
      sequence,
      witnessUtxo: {
        script: policy.scriptPubKey,
        value: input.value,
      },
      witnessScript: policy.script,
    });
  }
  for (const output of args.outputs) {
    psbt.addOutput({
      address: output.address,
      value: output.value,
    });
  }
  return psbt;
}

export function signFundPsbt(args: {
  psbt: Psbt;
  mnemonic: string;
  network: KoinonNetwork;
  inputs: Pick<FundInput, "change" | "index">[];
}): Psbt {
  args.inputs.forEach((input, index) => {
    args.psbt.signInput(index, signerAt(args.mnemonic, input.change, input.index, args.network));
  });
  return args.psbt;
}

export function finalizeFundPsbt(args: {
  psbt: Psbt;
  keys: PolicyKeys;
  network: KoinonNetwork;
  mode: WitnessMode;
  inputs: Pick<FundInput, "change" | "index">[];
}): string {
  args.inputs.forEach((input, index) => {
    const policy = compileFundPolicy(args.keys, input.index, args.network, input.change);
    finalizeInputWithPolicy(args.psbt, index, policy, args.keys, args.network, args.mode);
  });
  return args.psbt.extractTransaction(true).toHex();
}

/** Identity of the unsigned transaction, including the witness script each input commits to. */
export function spendSkeleton(psbt: Psbt): string {
  const inputs = psbt.txInputs.map((input, index) => {
    const witness = psbt.data.inputs[index]?.witnessScript;
    return [bytesToHex(input.hash), input.index, input.sequence, witness ? bytesToHex(witness) : ""].join(":");
  });
  const outputs = psbt.txOutputs.map((output) => `${bytesToHex(output.script)}:${output.value.toString()}`);
  return [psbt.version, psbt.locktime, inputs.join(","), outputs.join(",")].join("|");
}

export function assertSameSpend(left: Psbt, right: Psbt): void {
  if (spendSkeleton(left) !== spendSkeleton(right)) {
    throw new KoinonError(ErrorCode.PSBT_MISMATCH, "unsigned transaction changed");
  }
}

export function signatureCoversInput(psbt: Psbt, inputIndex: number, pubkey: Uint8Array): boolean {
  try {
    return psbt.validateSignaturesOfInput(
      inputIndex,
      (key: Uint8Array, hash: Uint8Array, signature: Uint8Array) => ecc.verify(hash, key, signature),
      pubkey,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("No signatures")) return false;
    throw error;
  }
}

function finalizeInputWithPolicy(
  psbt: Psbt,
  inputIndex: number,
  policy: CompiledPolicy,
  keys: PolicyKeys,
  network: KoinonNetwork,
  mode: WitnessMode,
): void {
  const officerPubkeys = keys.officers.map((officer) =>
    pubkeyAt(officer.xpub, policy.change, policy.index, network),
  ) as [Uint8Array, Uint8Array, Uint8Array];
  const assemblyPubkey = pubkeyAt(keys.assembly.xpub, policy.change, policy.index, network);
  psbt.finalizeInput(
    inputIndex,
    (
      _inputIndex: number,
      input: { partialSig?: { pubkey: Uint8Array; signature: Uint8Array }[] },
      witnessScript: Uint8Array,
    ) => {
      if (witnessScript === undefined) {
        throw new KoinonError(ErrorCode.PSBT_MISMATCH, "missing witness script");
      }
      assertSameScript(witnessScript, policy.script);
      const witness = buildWitness({
        mode,
        officerPubkeys,
        assemblyPubkey,
        partials: input.partialSig ?? [],
        witnessScript,
      });
      return {
        finalScriptSig: undefined,
        finalScriptWitness: encodeWitness(witness),
      };
    },
  );
}

export function p2wpkhAddress(pubkey: Uint8Array, network: KoinonNetwork): string {
  const payment = payments.p2wpkh({ pubkey, network: bitcoinNetwork(network) });
  if (!payment.address) {
    throw new KoinonError(ErrorCode.VALIDATION, "could not derive an address");
  }
  return payment.address;
}

export function psbtFromBase64(value: string, network: KoinonNetwork): Psbt {
  try {
    return Psbt.fromBase64(value, { network: bitcoinNetwork(network) });
  } catch {
    throw new KoinonError(ErrorCode.VALIDATION, "invalid psbt");
  }
}

export function outputScript(addr: string, network: KoinonNetwork): Uint8Array {
  return address.toOutputScript(addr, bitcoinNetwork(network));
}

export function scriptAsm(bytes: Uint8Array): string {
  return script.toASM(bytes);
}

export function pubkeyEquals(left: Uint8Array, right: Uint8Array): boolean {
  return bytesEqual(left, right);
}
