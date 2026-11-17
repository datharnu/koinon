import { ECPair } from "../packages/core/src/ecc.ts";
import { KoinonError } from "../packages/core/src/errors.ts";
import { accountFromMnemonic, mnemonicFromEntropy, pubkeyAt } from "../packages/core/src/keys.ts";
import { compileFundPolicy, type PolicyKeys } from "../packages/core/src/policy.ts";
import { createFundPsbt, p2wpkhAddress, signatureCoversInput } from "../packages/core/src/spend.ts";
import { signVerifiedSpend } from "../packages/core/src/verify.ts";

function entropy(byte: number): Uint8Array {
  return new Uint8Array(16).fill(byte);
}

function keys(): PolicyKeys {
  return {
    officers: [
      accountFromMnemonic(mnemonicFromEntropy(entropy(0x11)), "O1", "regtest"),
      accountFromMnemonic(mnemonicFromEntropy(entropy(0x22)), "O2", "regtest"),
      accountFromMnemonic(mnemonicFromEntropy(entropy(0x33)), "O3", "regtest"),
    ],
    assembly: accountFromMnemonic(mnemonicFromEntropy(entropy(0x44)), "K", "regtest"),
    csvBlocks: 10,
  };
}

function receive(fill: number): string {
  const secret = new Uint8Array(32);
  secret[31] = fill;
  return p2wpkhAddress(ECPair.fromPrivateKey(secret).publicKey, "regtest");
}

const fund = keys();
const recipient = receive(1);
const swapped = receive(2);
const change = compileFundPolicy(fund, 0, "regtest", 1).address;
const input = { txid: "11".repeat(32), vout: 0, value: 50_000n, change: 0 as const, index: 0 };
const mnemonic = mnemonicFromEntropy(entropy(0x11));
const approval = {
  network: "regtest" as const,
  keys: fund,
  recipient,
  amount: 40_000n,
  feeCap: 5_000n,
  memberIndexes: [0],
  mode: "path-a" as const,
};

const honest = createFundPsbt({
  network: "regtest",
  keys: fund,
  inputs: [input],
  outputs: [
    { address: recipient, value: 40_000n },
    { address: change, value: 9_000n },
  ],
  mode: "path-a",
});
const signed = signVerifiedSpend({ ...approval, psbt: honest, mnemonic });
const officer = fund.officers[0];
if (!officer) throw new Error("missing officer");
const honestSigned = signatureCoversInput(honest, 0, pubkeyAt(officer.xpub, 0, 0, "regtest"));

const tampered = createFundPsbt({
  network: "regtest",
  keys: fund,
  inputs: [input],
  outputs: [
    { address: swapped, value: 40_000n },
    { address: change, value: 9_000n },
  ],
  mode: "path-a",
});
let tamperCode = "ALLOWED";
try {
  signVerifiedSpend({ ...approval, psbt: tampered, mnemonic });
} catch (error) {
  tamperCode = error instanceof KoinonError ? error.code : "ERROR";
}
const tamperSigned = Boolean(tampered.data.inputs[0]?.partialSig?.length);

console.log("network: regtest");
console.log("regtest sats have no value");
console.log(`request amount: ${approval.amount.toString()} sats, fee cap: ${approval.feeCap.toString()}`);
console.log(`ALLOW honest: fee ${signed.fee.toString()} change ${signed.change.toString()} signed ${honestSigned}`);
console.log(`REFUSE tampered recipient: ${tamperCode}`);
console.log(`signed after refusal: ${tamperSigned}`);
if (tamperCode !== "PSBT_MISMATCH" || tamperSigned || !honestSigned) {
  process.exitCode = 1;
}
