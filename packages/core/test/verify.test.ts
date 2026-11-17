import { describe, expect, it } from "vitest";
import { payments } from "bitcoinjs-lib";
import { ECPair } from "../src/ecc.js";
import { KoinonError } from "../src/errors.js";
import { accountFromMnemonic, mnemonicFromEntropy, pubkeyAt } from "../src/keys.js";
import { bitcoinNetwork } from "../src/network.js";
import { compileFundPolicy, type PolicyKeys } from "../src/policy.js";
import { createFundPsbt, signatureCoversInput, type FundInput } from "../src/spend.js";
import { signVerifiedSpend, verifySpend, type SpendApproval } from "../src/verify.js";

function entropy(byte: number): Uint8Array {
  return new Uint8Array(16).fill(byte);
}

function keys(byte = 0x11): PolicyKeys {
  return {
    officers: [
      accountFromMnemonic(mnemonicFromEntropy(entropy(byte)), "O1", "regtest"),
      accountFromMnemonic(mnemonicFromEntropy(entropy(byte + 1)), "O2", "regtest"),
      accountFromMnemonic(mnemonicFromEntropy(entropy(byte + 2)), "O3", "regtest"),
    ],
    assembly: accountFromMnemonic(mnemonicFromEntropy(entropy(byte + 3)), "K", "regtest"),
    csvBlocks: 10,
  };
}

function receive(fill: number): string {
  const secret = new Uint8Array(32);
  secret[31] = fill;
  const payment = payments.p2wpkh({
    pubkey: ECPair.fromPrivateKey(secret).publicKey,
    network: bitcoinNetwork("regtest"),
  });
  if (!payment.address) throw new Error("address");
  return payment.address;
}

function approval(fund: PolicyKeys, recipient: string, feeCap = 5_000n): SpendApproval {
  return {
    network: "regtest",
    keys: fund,
    recipient,
    amount: 40_000n,
    feeCap,
    memberIndexes: [0],
    mode: "path-a",
  };
}

function coin(fund: PolicyKeys): { input: FundInput; change: string } {
  return {
    input: { txid: "11".repeat(32), vout: 0, value: 50_000n, change: 0, index: 0 },
    change: compileFundPolicy(fund, 0, "regtest", 1).address,
  };
}

function codeOf(run: () => void): string {
  try {
    run();
  } catch (error) {
    if (error instanceof KoinonError) return error.code;
    throw error;
  }
  return "ALLOWED";
}

describe("signer verification", () => {
  const fund = keys();
  const { input, change } = coin(fund);
  const recipient = receive(1);

  it("signs the locked recipient and amount", () => {
    const psbt = createFundPsbt({
      network: "regtest",
      keys: fund,
      inputs: [input],
      outputs: [
        { address: recipient, value: 40_000n },
        { address: change, value: 9_000n },
      ],
      mode: "path-a",
    });
    const signed = signVerifiedSpend({
      ...approval(fund, recipient),
      psbt,
      mnemonic: mnemonicFromEntropy(entropy(0x11)),
    });
    expect(signed.fee).toBe(1_000n);
    expect(signed.change).toBe(9_000n);
    const officer = fund.officers[0];
    if (!officer) throw new Error("missing officer");
    expect(signatureCoversInput(psbt, 0, pubkeyAt(officer.xpub, 0, 0, "regtest"))).toBe(true);
  });

  it("refuses a swapped recipient and does not sign", () => {
    const psbt = createFundPsbt({
      network: "regtest",
      keys: fund,
      inputs: [input],
      outputs: [
        { address: receive(2), value: 40_000n },
        { address: change, value: 9_000n },
      ],
      mode: "path-a",
    });
    expect(codeOf(() => signVerifiedSpend({ ...approval(fund, recipient), psbt, mnemonic: mnemonicFromEntropy(entropy(0x11)) }))).toBe(
      "PSBT_MISMATCH",
    );
    expect(psbt.data.inputs[0]?.partialSig).toBeUndefined();
  });

  it("refuses a different amount", () => {
    const psbt = createFundPsbt({
      network: "regtest",
      keys: fund,
      inputs: [input],
      outputs: [
        { address: recipient, value: 39_000n },
        { address: change, value: 10_000n },
      ],
      mode: "path-a",
    });
    expect(codeOf(() => verifySpend(psbt, approval(fund, recipient)))).toBe("PSBT_MISMATCH");
  });

  it("refuses change that leaves the fund", () => {
    const psbt = createFundPsbt({
      network: "regtest",
      keys: fund,
      inputs: [input],
      outputs: [
        { address: recipient, value: 40_000n },
        { address: receive(3), value: 9_000n },
      ],
      mode: "path-a",
    });
    expect(codeOf(() => verifySpend(psbt, approval(fund, recipient)))).toBe("PSBT_MISMATCH");
  });

  it("refuses a fee above the cap", () => {
    const psbt = createFundPsbt({
      network: "regtest",
      keys: fund,
      inputs: [input],
      outputs: [{ address: recipient, value: 40_000n }],
      mode: "path-a",
    });
    expect(codeOf(() => verifySpend(psbt, approval(fund, recipient, 1_000n)))).toBe("FEE_OVER_CAP");
  });

  it("refuses an input that is not this fund", () => {
    const other = keys(0x21);
    const psbt = createFundPsbt({
      network: "regtest",
      keys: other,
      inputs: [{ ...coin(other).input }],
      outputs: [
        { address: recipient, value: 40_000n },
        { address: compileFundPolicy(other, 0, "regtest", 1).address, value: 9_000n },
      ],
      mode: "path-a",
    });
    expect(codeOf(() => verifySpend(psbt, approval(fund, recipient)))).toBe("PSBT_MISMATCH");
  });
});
