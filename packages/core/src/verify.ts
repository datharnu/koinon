import type { Psbt } from "bitcoinjs-lib";
import { bytesEqual } from "./bytes.js";
import { DUST_SATS } from "./coinselect.js";
import { ErrorCode, KoinonError } from "./errors.js";
import type { KoinonNetwork } from "./network.js";
import { compileFundPolicy, type PolicyKeys } from "./policy.js";
import { outputScript, PATH_A_SEQUENCE, signFundPsbt } from "./spend.js";
import type { WitnessMode } from "./witness.js";

/**
 * What the officer read and decided to approve.
 * Scripts are derived here from the xpubs. A change address or input list
 * supplied by the coordinator is not an input to this check.
 */
export interface SpendApproval {
  network: KoinonNetwork;
  keys: PolicyKeys;
  recipient: string;
  amount: bigint;
  feeCap: bigint;
  /** Receive indexes this officer accepts. The change address is always included. */
  memberIndexes: number[];
  mode: WitnessMode;
}

export interface VerifiedInput {
  change: 0 | 1;
  index: number;
  value: bigint;
}

export interface VerifiedSpend {
  inputs: VerifiedInput[];
  fee: bigint;
  change: bigint;
}

interface FundScript {
  change: 0 | 1;
  index: number;
  script: Uint8Array;
  scriptPubKey: Uint8Array;
}

export function verifySpend(psbt: Psbt, approval: SpendApproval): VerifiedSpend {
  if (approval.amount < DUST_SATS) {
    throw new KoinonError(ErrorCode.VALIDATION, "amount is below the dust limit");
  }
  if (approval.feeCap <= 0n) {
    throw new KoinonError(ErrorCode.VALIDATION, "fee cap must be positive");
  }
  const allowed = fundScripts(approval);
  const recipientScript = outputScript(approval.recipient, approval.network);
  const changeScript = allowed.find((item) => item.change === 1);
  if (!changeScript) {
    throw new KoinonError(ErrorCode.VALIDATION, "fund change address is missing");
  }
  const sequence = approval.mode === "path-b" ? approval.keys.csvBlocks : PATH_A_SEQUENCE;
  if (psbt.txInputs.length === 0) {
    throw new KoinonError(ErrorCode.PSBT_MISMATCH, "the transaction has no inputs");
  }

  const inputs: VerifiedInput[] = [];
  let inputSum = 0n;
  psbt.txInputs.forEach((input, index) => {
    const data = psbt.data.inputs[index];
    const witnessScript = data?.witnessScript;
    const witnessUtxo = data?.witnessUtxo;
    if (!witnessScript || !witnessUtxo) {
      throw new KoinonError(ErrorCode.PSBT_MISMATCH, "an input is not a fund coin");
    }
    const match = allowed.find(
      (item) => bytesEqual(item.script, witnessScript) && bytesEqual(item.scriptPubKey, witnessUtxo.script),
    );
    if (!match) {
      throw new KoinonError(ErrorCode.PSBT_MISMATCH, "an input is not a fund coin");
    }
    if (input.sequence !== sequence) {
      throw new KoinonError(ErrorCode.PSBT_MISMATCH, "the input is not the approved spending path");
    }
    inputs.push({ change: match.change, index: match.index, value: witnessUtxo.value });
    inputSum += witnessUtxo.value;
  });

  let recipientCount = 0;
  let changeValue = 0n;
  let outputSum = 0n;
  for (const output of psbt.txOutputs) {
    outputSum += output.value;
    if (bytesEqual(output.script, recipientScript)) {
      recipientCount += 1;
      if (output.value !== approval.amount) {
        throw new KoinonError(ErrorCode.PSBT_MISMATCH, "the recipient amount is not the locked amount");
      }
      continue;
    }
    if (bytesEqual(output.script, changeScript.scriptPubKey)) {
      changeValue += output.value;
      continue;
    }
    throw new KoinonError(ErrorCode.PSBT_MISMATCH, "change does not return to the fund");
  }
  if (recipientCount !== 1) {
    throw new KoinonError(ErrorCode.PSBT_MISMATCH, "the transaction does not pay the requested recipient");
  }
  if (outputSum > inputSum) {
    throw new KoinonError(ErrorCode.PSBT_MISMATCH, "outputs exceed the fund inputs");
  }
  const fee = inputSum - outputSum;
  if (fee > approval.feeCap) {
    throw new KoinonError(ErrorCode.FEE_OVER_CAP, "the fee for this spend is above the fee cap");
  }
  return { inputs, fee, change: changeValue };
}

/** Verify first. No signature is added when the check throws. */
export function signVerifiedSpend(args: SpendApproval & { psbt: Psbt; mnemonic: string }): VerifiedSpend & { psbt: Psbt } {
  const verified = verifySpend(args.psbt, args);
  signFundPsbt({
    psbt: args.psbt,
    mnemonic: args.mnemonic,
    network: args.network,
    inputs: verified.inputs,
  });
  return { ...verified, psbt: args.psbt };
}

function fundScripts(approval: SpendApproval): FundScript[] {
  const scripts: FundScript[] = [];
  for (const index of approval.memberIndexes) {
    if (!Number.isInteger(index) || index < 0) {
      throw new KoinonError(ErrorCode.VALIDATION, "member index is invalid");
    }
    const policy = compileFundPolicy(approval.keys, index, approval.network, 0);
    scripts.push({ change: 0, index, script: policy.script, scriptPubKey: policy.scriptPubKey });
  }
  const change = compileFundPolicy(approval.keys, 0, approval.network, 1);
  scripts.push({ change: 1, index: 0, script: change.script, scriptPubKey: change.scriptPubKey });
  return scripts;
}
