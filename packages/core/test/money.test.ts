import { describe, expect, it } from "vitest";
import { payments, Psbt } from "bitcoinjs-lib";
import { ECPair } from "../src/ecc.js";
import {
  accountFromMnemonic,
  accountSigner,
  authPayload,
  createFundPsbt,
  mnemonicFromEntropy,
  pubkeyAt,
  satsForXof,
  selectCoins,
  signAuth,
  signFundPsbt,
  signatureCoversInput,
  spendSkeleton,
  verifyAuth,
  xofForSats,
  xofPerBtcFromEur,
  type PolicyKeys,
} from "../src/index.js";
import { bitcoinNetwork } from "../src/network.js";

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

describe("cfa", () => {
  it("keeps the peg exact", () => {
    expect(xofPerBtcFromEur("1")).toBe("655.957");
    expect(xofPerBtcFromEur("2")).toBe("1311.914");
  });

  it("rounds sats up and does not leave the recipient short", () => {
    const eur = "60000";
    const amount = 1000n;
    const sats = satsForXof(amount, eur);
    const truncated = (amount * 100_000_000n * 1000n) / (60000n * 655957n);
    expect(sats >= truncated).toBe(true);
    expect(xofForSats(sats, eur) >= amount).toBe(true);
    expect(xofForSats(sats - 1n, eur) < amount).toBe(true);
  });
});

describe("coin selection", () => {
  const coin = (value: bigint, vout = 0) => ({
    txid: "aa".repeat(32),
    vout,
    value,
    change: 0 as const,
    index: 0,
  });

  it("pays the exact amount and keeps the fee under the cap", () => {
    const selected = selectCoins({
      coins: [coin(5_000n, 1), coin(10_000n, 0)],
      amount: 4_000n,
      feeCap: 5_000n,
    });
    expect(selected.inputs.map((input) => input.value)).toEqual([10_000n]);
    expect(selected.recipient).toBe(4_000n);
    expect(selected.fee + selected.change + selected.recipient).toBe(10_000n);
    expect(selected.fee <= 5_000n).toBe(true);
    expect(selected.change > 0n).toBe(true);
  });

  it("refuses when the fee would exceed the cap", () => {
    expect(() =>
      selectCoins({ coins: [coin(10_000n)], amount: 4_000n, feeCap: 100n }),
    ).toThrow(/fee cap/);
  });

  it("refuses when the coins cannot cover the amount", () => {
    expect(() =>
      selectCoins({ coins: [coin(1_000n)], amount: 4_000n, feeCap: 5_000n }),
    ).toThrow(/cannot cover/);
  });
});

describe("officer auth and psbt identity", () => {
  it("accepts the account signature and rejects a different officer", () => {
    const payload = authPayload({
      method: "POST",
      path: "/v1/funds/abc/requests",
      timestamp: 1_700_000_000_000,
      nonce: "abc123",
      body: new TextEncoder().encode("{}"),
    });
    const signer = accountSigner(mnemonicFromEntropy(entropy(0x11)), "regtest");
    const signature = signAuth(signer, payload);
    expect(verifyAuth(signer.publicKey, payload, signature)).toBe(true);
    const other = accountSigner(mnemonicFromEntropy(entropy(0x22)), "regtest");
    expect(verifyAuth(other.publicKey, payload, signature)).toBe(false);
  });

  it("changes the skeleton when the recipient changes", () => {
    const fund = keys();
    const inputs = [
      { txid: "11".repeat(32), vout: 0, value: 50_000n, change: 0 as const, index: 0 },
    ];
    const first = createFundPsbt({
      network: "regtest",
      keys: fund,
      inputs,
      outputs: [{ address: receive(), value: 40_000n }],
      mode: "path-a",
    });
    const second = createFundPsbt({
      network: "regtest",
      keys: fund,
      inputs,
      outputs: [{ address: receive(2), value: 40_000n }],
      mode: "path-a",
    });
    expect(spendSkeleton(first)).not.toBe(spendSkeleton(second));
    const signed = Psbt.fromBase64(
      signFundPsbt({
        psbt: first,
        mnemonic: mnemonicFromEntropy(entropy(0x11)),
        network: "regtest",
        inputs,
      }).toBase64(),
      { network: bitcoinNetwork("regtest") },
    );
    expect(spendSkeleton(signed)).toBe(spendSkeleton(first));
    const officer = fund.officers[0];
    if (!officer) throw new Error("missing officer");
    expect(signatureCoversInput(signed, 0, pubkeyAt(officer.xpub, 0, 0, "regtest"))).toBe(true);
  });
});

function receive(fill = 1): string {
  const secret = new Uint8Array(32);
  secret[31] = fill;
  const payment = payments.p2wpkh({
    pubkey: ECPair.fromPrivateKey(secret).publicKey,
    network: bitcoinNetwork("regtest"),
  });
  if (!payment.address) throw new Error("address");
  return payment.address;
}
