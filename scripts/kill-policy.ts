import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  accountFromMnemonic,
  bytesToHex,
  compileFundPolicy,
  createSpendPsbt,
  finalizeSpend,
  mnemonicFromEntropy,
  signerAt,
  signSpend,
  type PolicyKeys,
} from "../packages/core/src/index.ts";
import { startRegtest, type Regtest } from "./regtest.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSV_BLOCKS = 10;
const ONE_BTC = 100_000_000n;
const FEE = 10_000n;

function entropy(byte: number): Uint8Array {
  return new Uint8Array(16).fill(byte);
}

function demoKeys(): PolicyKeys {
  return {
    officers: [
      accountFromMnemonic(mnemonicFromEntropy(entropy(0x11)), "O1", "regtest"),
      accountFromMnemonic(mnemonicFromEntropy(entropy(0x22)), "O2", "regtest"),
      accountFromMnemonic(mnemonicFromEntropy(entropy(0x33)), "O3", "regtest"),
    ],
    assembly: accountFromMnemonic(mnemonicFromEntropy(entropy(0x44)), "K", "regtest"),
    csvBlocks: CSV_BLOCKS,
  };
}

async function main(): Promise<void> {
  const regtest = await startRegtest(root);
  try {
    const version = (await regtest.rpc("getnetworkinfo", [])) as { subversion: string };
    console.log(`bitcoind: ${version.subversion}`);
    console.log("network: regtest");
    await regtest.rpc("createwallet", ["bootstrap"]);
    const wallet = "bootstrap";
    const mineTo = (await regtest.rpc("getnewaddress", [], wallet)) as string;
    await regtest.rpc("generatetoaddress", [101, mineTo]);

    const keys = demoKeys();
    const policy = compileFundPolicy(keys, 0, "regtest");
    console.log(`address: ${policy.address}`);
    console.log(`script: ${bytesToHex(policy.script)}`);
    console.log(`issane: ${policy.issane} (${policy.sanityError})`);

    const txidA = (await regtest.rpc("sendtoaddress", [policy.address, "1"], wallet)) as string;
    const txidB = (await regtest.rpc("sendtoaddress", [policy.address, "1"], wallet)) as string;
    await regtest.rpc("generatetoaddress", [1, mineTo]);

    const inputA = await fundOutput(regtest, txidA, policy.scriptPubKey);
    const inputB = await fundOutput(regtest, txidB, policy.scriptPubKey);
    const destA = (await regtest.rpc("getnewaddress", [], wallet)) as string;
    const destB = (await regtest.rpc("getnewaddress", [], wallet)) as string;
    const pay = ONE_BTC - FEE;

    const attack = createSpendPsbt({
      network: "regtest",
      policy,
      input: inputA,
      outputs: [{ address: destA, value: pay }],
      mode: "single-sig-attack",
    });
    signSpend(attack, signerAt(mnemonicFromEntropy(entropy(0x11)), 0, 0, "regtest"));
    const attackHex = finalizeSpend({
      psbt: attack,
      policy,
      keys,
      network: "regtest",
      mode: "single-sig-attack",
    });
    await expectReject(regtest, attackHex, "1-signature");

    const allow = createSpendPsbt({
      network: "regtest",
      policy,
      input: inputA,
      outputs: [{ address: destA, value: pay }],
      mode: "path-a",
    });
    signSpend(allow, signerAt(mnemonicFromEntropy(entropy(0x11)), 0, 0, "regtest"));
    signSpend(allow, signerAt(mnemonicFromEntropy(entropy(0x22)), 0, 0, "regtest"));
    const allowHex = finalizeSpend({
      psbt: allow,
      policy,
      keys,
      network: "regtest",
      mode: "path-a",
    });
    const spent = (await regtest.rpc("sendrawtransaction", [allowHex])) as string;
    await regtest.rpc("generatetoaddress", [1, mineTo]);
    const confirmed = (await regtest.rpc("getrawtransaction", [spent, true])) as { confirmations?: number };
    console.log(`ALLOW 2-of-3 txid: ${spent}`);
    console.log(`ALLOW 2-of-3 confirmations: ${confirmed.confirmations ?? 0}`);
    if ((confirmed.confirmations ?? 0) < 1) {
      throw new Error("2-of-3 transaction was not confirmed");
    }

    const recovery = createSpendPsbt({
      network: "regtest",
      policy,
      input: inputB,
      outputs: [{ address: destB, value: pay }],
      mode: "path-b",
    });
    signSpend(recovery, signerAt(mnemonicFromEntropy(entropy(0x44)), 0, 0, "regtest"));
    signSpend(recovery, signerAt(mnemonicFromEntropy(entropy(0x33)), 0, 0, "regtest"));
    const recoveryHex = finalizeSpend({
      psbt: recovery,
      policy,
      keys,
      network: "regtest",
      mode: "path-b",
    });
    await expectReject(regtest, recoveryHex, "path B before CSV");
    await regtest.rpc("generatetoaddress", [CSV_BLOCKS, mineTo]);
    const recovered = (await regtest.rpc("sendrawtransaction", [recoveryHex])) as string;
    await regtest.rpc("generatetoaddress", [1, mineTo]);
    const recoveredTx = (await regtest.rpc("getrawtransaction", [recovered, true])) as {
      confirmations?: number;
    };
    console.log(`ALLOW path B txid: ${recovered}`);
    console.log(`ALLOW path B confirmations: ${recoveredTx.confirmations ?? 0}`);
    if ((recoveredTx.confirmations ?? 0) < 1) {
      throw new Error("path B transaction was not confirmed");
    }
  } finally {
    await regtest.stop();
  }
}

async function fundOutput(
  regtest: Regtest,
  txid: string,
  scriptPubKey: Uint8Array,
): Promise<{ txid: string; vout: number; value: bigint }> {
  const tx = (await regtest.rpc("getrawtransaction", [txid, true])) as {
    vout: { n: number; value: number; scriptPubKey: { hex: string } }[];
  };
  const want = bytesToHex(scriptPubKey);
  const output = tx.vout.find((item) => item.scriptPubKey.hex === want);
  if (!output || output.value !== 1) {
    throw new Error(`funding output not found on ${txid}`);
  }
  return { txid, vout: output.n, value: ONE_BTC };
}

async function expectReject(regtest: Regtest, hex: string, label: string): Promise<void> {
  const accepted = (await regtest.rpc("testmempoolaccept", [[hex]])) as {
    allowed: boolean;
    "reject-reason"?: string;
  }[];
  const verdict = accepted[0];
  console.log(
    `REFUSE ${label} testmempoolaccept: allowed=${verdict?.allowed} reason=${verdict?.["reject-reason"] ?? ""}`,
  );
  if (verdict?.allowed) {
    throw new Error(`${label} was accepted by bitcoind`);
  }
  try {
    await regtest.rpc("sendrawtransaction", [hex]);
    throw new Error(`${label} sendrawtransaction succeeded`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("succeeded")) throw error;
    console.log(`REFUSE ${label} sendrawtransaction: ${message}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
