import { spawn } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decryptKey, type EncryptedKey } from "../packages/core/src/keystore.ts";
import { buildApp } from "../apps/coordinator/src/app.ts";
import { bitcoinRpc } from "../apps/coordinator/src/bitcoin.ts";
import { openDatabase } from "../apps/coordinator/src/db.ts";
import { startLocalRelay } from "../packages/nostr/src/local-relay.ts";
import { startRegtest } from "./regtest.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const home = path.join(root, ".koinon-demo");
const port = 8797;
const pin = "demo-pin";

function run(args: string[], env: NodeJS.ProcessEnv): Promise<{ code: number; out: string }> {
  const tsx = path.join(root, "node_modules/.bin/tsx");
  return new Promise((resolve, reject) => {
    const child = spawn(tsx, [path.join(root, "apps/cli/src/main.ts"), ...args], { cwd: root, env });
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      out += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, out }));
  });
}

async function main(): Promise<void> {
  rmSync(home, { recursive: true, force: true });
  const regtest = await startRegtest(root);
  const relay = await startLocalRelay();
  const app = buildApp({
    db: openDatabase(":memory:"),
    bitcoin: bitcoinRpc({ url: "http://127.0.0.1:18445", user: "koinon", password: "koinon" }),
    fetchEur: async () => "60000",
    logger: false,
  });
  const lines: string[] = [];
  const note = (ok: boolean, label: string, detail: string) => lines.push(`${ok ? "PASS" : "FAIL"} ${label}: ${detail}`);
  let transcript = "";
  try {
    console.log("network: regtest");
    console.log("regtest sats have no value");
    console.log("rate: test double 60000 EUR, not a market price");
    await app.listen({ port, host: "127.0.0.1" });
    await regtest.rpc("createwallet", ["bootstrap"]);
    const mineTo = (await regtest.rpc("getnewaddress", [], "bootstrap")) as string;
    await regtest.rpc("generatetoaddress", [101, mineTo]);
    const dest = (await regtest.rpc("getnewaddress", [], "bootstrap")) as string;
    const env = {
      ...process.env,
      KOINON_HOME: home,
      KOINON_COORDINATOR: `http://127.0.0.1:${port}`,
      KOINON_RELAY: relay.url,
      KOINON_PIN: pin,
      BITCOIN_RPC_URL: "http://127.0.0.1:18445",
      BITCOIN_RPC_USER: "koinon",
      BITCOIN_RPC_PASSWORD: "koinon",
      BITCOIN_RPC_WALLET: "bootstrap",
    };
    const step = async (label: string, args: string[], expect: RegExp) => {
      const result = await run(args, env);
      transcript += result.out;
      console.log(`$ koinon ${args.join(" ")}`);
      console.log(result.out.trim());
      note(result.code === 0 && expect.test(result.out), label, result.code === 0 ? "ok" : `exit ${result.code}`);
      return result.out;
    };
    await step("init", ["init-fund", "--name", "Dahira Demo", "--csv", "10", "--fee-cap", "100000"], /Fonds créé/);
    await step("member", ["member", "add", "membre-1"], /bcrt1/);
    await step("member 2", ["member", "add", "membre-2"], /bcrt1/);
    await step("contribute", ["contribute", "membre-1", "5000"], /Contribution envoyée/);
    await step("contribute 2", ["contribute", "membre-2", "5000"], /Contribution envoyée/);
    await step("mine", ["mine", "1"], /1 bloc miné/);
    await step("status", ["status"], /Solde (?!0 )/);
    const requested = await step("request", ["request", "1000", dest, "fournitures", "--as", "O1"], /Demande /);
    const requestId = requested.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? "";
    await step("tamper", ["attack", "tamper", requestId, "--as", "O2"], /PSBT_MISMATCH/);
    await step("single-sig", ["attack", "single-sig", requestId, "--as", "O1"], /Signature must be zero/);
    await step("approve O1", ["approve", requestId, "--as", "O1"], /Signature acceptée/);
    await step("approve O2", ["approve", requestId, "--as", "O2"], /approuvé|Signature acceptée/);
    await step("broadcast", ["broadcast", requestId], /Transaction diffusée/);
    await step("mine spend", ["mine", "1"], /1 bloc miné/);
    await step("ledger", ["status"], /spend/);
    const second = await step("request 2", ["request", "1000", dest, "autre", "--as", "O1"], /Demande /);
    const secondId = second.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? "";
    await step("reject", ["reject", secondId, "--as", "O3", "--reason", "pas maintenant"], /Demande refusée/);
    await step("recover early", ["recover", dest, "--as", "O3"], /non-BIP68-final/);
    await step("mine csv", ["mine", "10"], /10 blocs minés/);
    await step("recover late", ["recover", dest, "--as", "O3"], /Récupération acceptée/);
    await step("audit", ["audit", "verify"], /Audit intact/);
    const sealed = JSON.parse(readFileSync(path.join(home, "keys", "O1.json"), "utf8")) as EncryptedKey;
    const mnemonic = JSON.parse(new TextDecoder().decode(await decryptKey(sealed, pin))) as { mnemonic: string };
    const word = mnemonic.mnemonic.split(" ")[0] ?? "";
    const stored = readFileSync(path.join(home, "keys", "O1.json"), "utf8");
    note(word.length > 0 && !stored.includes(word) && !transcript.includes(word), "key file", "mnemonic is not stored in the clear");
    note(!transcript.includes("nsec") && !transcript.includes("xprv") && !transcript.includes(pin), "stdout", "no secret");
    console.log(lines.join("\n"));
    if (lines.some((item) => item.startsWith("FAIL"))) process.exitCode = 1;
  } finally {
    await app.close();
    await relay.close();
    await regtest.stop();
  }
}

await main();
