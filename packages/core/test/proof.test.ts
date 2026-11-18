import { Transaction } from "bitcoinjs-lib";
import { describe, expect, it } from "vitest";
import {
  accountFromMnemonic,
  compileFundPolicy,
  createFundPsbt,
  finalizeFundPsbt,
  mnemonicFromEntropy,
  p2wpkhAddress,
  pubkeyAt,
  signFundPsbt,
  type PolicyKeys,
} from "../src/index.js";
import {
  auditDigest,
  checkAddresses,
  constitutionHash,
  deriveFundScript,
  inspectTransaction,
  pubkeyAtXpub,
  verifyAuditChain,
  type FundXpubs,
} from "../src/proof.js";

function entropy(byte: number): Uint8Array {
  return new Uint8Array(16).fill(byte);
}

function demoKeys(csvBlocks = 10): PolicyKeys {
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

function xpubs(keys: PolicyKeys): FundXpubs {
  return {
    officers: [keys.officers[0].xpub, keys.officers[1].xpub, keys.officers[2].xpub],
    assembly: keys.assembly.xpub,
    csvBlocks: keys.csvBlocks,
  };
}

function parentOf(script: Uint8Array, sats: bigint): Transaction {
  const tx = new Transaction();
  tx.version = 2;
  tx.addInput(new Uint8Array(32), 0xffffffff, 0xffffffff);
  tx.addOutput(script, sats);
  return tx;
}

describe("constitution and audit", () => {
  const keys = xpubs(demoKeys());

  it("changes the fingerprint when any key or the delay changes", () => {
    const hash = constitutionHash(keys);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(constitutionHash(keys)).toBe(hash);
    expect(constitutionHash({ ...keys, csvBlocks: 11 })).not.toBe(hash);
    expect(constitutionHash({ ...keys, assembly: keys.officers[0] })).not.toBe(hash);
  });

  it("recomputes the hash chain and stops at the broken row", () => {
    const first = { seq: 1, prev_hash: "0".repeat(64), at: "2026-11-17T00:00:00.000Z", actor: "system", action: "fund.create", request_id: null, detail: "{\"csv_blocks\":10}" };
    const row1 = { ...first, hash: auditDigest(first) };
    const second = { seq: 2, prev_hash: row1.hash, at: "2026-11-17T00:01:00.000Z", actor: "system", action: "member.add", request_id: null, detail: "{\"index\":0}" };
    const row2 = { ...second, hash: auditDigest(second) };
    expect(verifyAuditChain([row1, row2])).toEqual({ ok: true, seq: null, checked: 2, total: 2 });
    const broken = { ...row2, detail: "{\"index\":1}", hash: row2.hash };
    expect(verifyAuditChain([row1, broken]).ok).toBe(false);
    expect(verifyAuditChain([row1, broken]).seq).toBe(2);
    expect(verifyAuditChain([row1, broken]).checked).toBe(1);
  });
});

describe("script derived without the compiler", () => {
  it("matches the miniscript compiler, the address, and the child pubkey", () => {
    for (const csv of [1, 10, 17, 4320]) {
      const keys = demoKeys(csv);
      for (const index of [0, 3]) {
        for (const change of [0, 1] as const) {
          const compiled = compileFundPolicy(keys, index, "regtest", change);
          const derived = deriveFundScript(xpubs(keys), change, index);
          expect(Buffer.from(derived.script).toString("hex")).toBe(Buffer.from(compiled.script).toString("hex"));
          expect(derived.address).toBe(compiled.address);
        }
      }
      const compiled = compileFundPolicy(keys, 0, "regtest", 0);
      const noble = pubkeyAtXpub(keys.officers[0].xpub, 0, 0);
      const lib = pubkeyAt(keys.officers[0].xpub, 0, 0, "regtest");
      expect(Buffer.from(noble).toString("hex")).toBe(Buffer.from(lib).toString("hex"));
      expect(compiled.address.startsWith("bcrt1q")).toBe(true);
    }
  });

  it("accepts a member address only when it is the derived one", () => {
    const keys = demoKeys();
    const member = compileFundPolicy(keys, 0, "regtest", 0);
    const change = compileFundPolicy(keys, 0, "regtest", 1);
    const ok = checkAddresses(xpubs(keys), [{ index: 0, address: member.address }], change.address);
    expect(ok).toEqual({ memberMatches: 1, members: 1, badIndexes: [], changeOk: true });
    const swapped = checkAddresses(xpubs(keys), [{ index: 0, address: change.address }], change.address);
    expect(swapped.badIndexes).toEqual([0]);
    expect(swapped.changeOk).toBe(true);
  });
});

describe("witness inspection", () => {
  const keys = demoKeys(10);
  const policy = compileFundPolicy(keys, 0, "regtest", 0);
  const value = 100_000n;
  const parent = parentOf(policy.scriptPubKey, value);
  const destination = p2wpkhAddress(pubkeyAt(keys.officers[0].xpub, 0, 9, "regtest"), "regtest");

  function spend(mode: "path-a" | "path-b", signers: ("O1" | "O2" | "K")[]): string {
    const input = { txid: parent.getId(), vout: 0, value, change: 0 as const, index: 0 };
    const psbt = createFundPsbt({
      network: "regtest",
      keys,
      inputs: [input],
      outputs: [{ address: destination, value: 90_000n }],
      mode,
    });
    for (const role of signers) {
      const mnemonic = role === "K" ? mnemonicFromEntropy(entropy(0x44)) : mnemonicFromEntropy(entropy(role === "O1" ? 0x11 : 0x22));
      signFundPsbt({ psbt, mnemonic, network: "regtest", inputs: [input] });
    }
    return finalizeFundPsbt({ psbt, keys, network: "regtest", mode, inputs: [input] });
  }

  const parents = [{ txid: parent.getId(), hex: parent.toHex() }];

  it("names the two officers whose signatures are in a path A witness", () => {
    const seen = inspectTransaction({ hex: spend("path-a", ["O1", "O2"]), keys: xpubs(keys), indexes: [0], parents });
    expect(seen.ok).toBe(true);
    expect(seen.direction).toBe("spend");
    expect(seen.path).toBe("A");
    expect(seen.signers).toEqual(["O1", "O2"]);
    expect(seen.outputs.filter((output) => output.role === "external").map((output) => output.sats)).toEqual(["90000"]);
    expect(seen.feeSats).toBe("10000");
    expect(seen.inputs[0]?.outputCommit).toBe(true);
  });

  it("names the officer and the assembly key on path B", () => {
    const seen = inspectTransaction({ hex: spend("path-b", ["O1", "K"]), keys: xpubs(keys), indexes: [0], parents });
    expect(seen.ok).toBe(true);
    expect(seen.path).toBe("B");
    expect(seen.signers).toEqual(["O1", "K"]);
  });

  it("does not accept the witness when the delay in the keys is different", () => {
    const seen = inspectTransaction({
      hex: spend("path-a", ["O1", "O2"]),
      keys: { ...xpubs(keys), csvBlocks: 11 },
      indexes: [0],
      parents,
    });
    expect(seen.ok).toBe(false);
    expect(seen.inputs.every((input) => input.scriptMatch === false)).toBe(true);
  });

  it("does not check signatures when the parent transaction is withheld", () => {
    const seen = inspectTransaction({ hex: spend("path-a", ["O1", "O2"]), keys: xpubs(keys), indexes: [0] });
    expect(seen.ok).toBe(false);
    expect(seen.inputs[0]?.signaturesChecked).toBe(false);
    expect(seen.reason).toContain("value");
  });
});
