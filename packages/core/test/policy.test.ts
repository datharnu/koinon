import { describe, expect, it } from "vitest";
import { script } from "bitcoinjs-lib";
import {
  accountFromMnemonic,
  buildWitness,
  compileFundPolicy,
  encodeWitness,
  mnemonicFromEntropy,
  scriptAsm,
  type PolicyKeys,
} from "../src/index.js";

function entropy(byte: number): Uint8Array {
  return new Uint8Array(16).fill(byte);
}

function demoKeys(csvBlocks: number): PolicyKeys {
  return {
    officers: [
      accountFromMnemonic(mnemonicFromEntropy(entropy(0x11)), "O1", "regtest"),
      accountFromMnemonic(mnemonicFromEntropy(entropy(0x22)), "O2", "regtest"),
      accountFromMnemonic(mnemonicFromEntropy(entropy(0x33)), "O3", "regtest"),
    ],
    assembly: accountFromMnemonic(mnemonicFromEntropy(entropy(0x44)), "K", "regtest"),
    csvBlocks,
  };
}

describe("fund policy", () => {
  const keys = demoKeys(10);
  const policy = compileFundPolicy(keys, 0, "regtest");

  it("derives the same address twice", () => {
    const again = compileFundPolicy(keys, 0, "regtest");
    expect(again.address).toBe(policy.address);
    expect(again.script).toEqual(policy.script);
  });

  it("uses a regtest p2wsh address and a different index for the next member", () => {
    expect(policy.address.startsWith("bcrt1q")).toBe(true);
    const next = compileFundPolicy(keys, 1, "regtest");
    expect(next.address).not.toBe(policy.address);
  });

  it("compiles the spec expression, including the timelock, and records the repeated-key warning", () => {
    expect(policy.expression.startsWith("or_d(multi(2,")).toBe(true);
    expect(policy.expression).toContain("older(10)");
    expect(policy.issane).toBe(false);
    expect(policy.sanityError).toContain("repeated public keys");
    const asm = scriptAsm(policy.script);
    expect(asm).toContain("OP_CHECKMULTISIG");
    expect(asm).toContain("OP_IFDUP");
    expect(asm).toContain("OP_NOTIF");
    // bitcoinjs names opcode 0xb2 OP_NOP3 in toASM. It is CHECKSEQUENCEVERIFY.
    const chunks = script.decompile(policy.script);
    expect(chunks).toContain(script.OPS.OP_CHECKSEQUENCEVERIFY);
  });

  it("encodes a 10-block timelock as OP_10", () => {
    const chunks = script.decompile(policy.script);
    expect(chunks).toContain(script.OPS.OP_CHECKSEQUENCEVERIFY);
    const csvAt = chunks?.indexOf(script.OPS.OP_CHECKSEQUENCEVERIFY) ?? -1;
    expect(chunks?.[csvAt - 1]).toBe(script.OPS.OP_10);
  });
});

describe("witness bytes", () => {
  it("encodes a stack with a compact size per item", () => {
    expect(encodeWitness([Uint8Array.of(1, 2)])).toEqual(Uint8Array.of(1, 2, 1, 2));
    expect(encodeWitness([new Uint8Array()])).toEqual(Uint8Array.of(1, 0));
  });

  it("puts the later officer signature on top for path A", () => {
    const officers = [Uint8Array.of(1), Uint8Array.of(2), Uint8Array.of(3)] as [
      Uint8Array,
      Uint8Array,
      Uint8Array,
    ];
    const witness = buildWitness({
      mode: "path-a",
      officerPubkeys: officers,
      assemblyPubkey: Uint8Array.of(9),
      partials: [
        { pubkey: officers[0], signature: Uint8Array.of(0xaa) },
        { pubkey: officers[2], signature: Uint8Array.of(0xcc) },
      ],
      witnessScript: Uint8Array.of(0x51),
    });
    expect(witness.map((item) => Array.from(item))).toEqual([[], [0xaa], [0xcc], [0x51]]);
  });

  it("refuses a one-signature path A unless the caller asked for the attack witness", () => {
    const officers = [Uint8Array.of(1), Uint8Array.of(2), Uint8Array.of(3)] as [
      Uint8Array,
      Uint8Array,
      Uint8Array,
    ];
    const args = {
      officerPubkeys: officers,
      assemblyPubkey: Uint8Array.of(9),
      partials: [{ pubkey: officers[1], signature: Uint8Array.of(0xbb) }],
      witnessScript: Uint8Array.of(0x51),
    };
    expect(() => buildWitness({ ...args, mode: "path-a" })).toThrow(/two officer signatures/);
    const attack = buildWitness({ ...args, mode: "single-sig-attack" });
    expect(attack.map((item) => Array.from(item))).toEqual([[], [], [0xbb], [0x51]]);
  });
});
