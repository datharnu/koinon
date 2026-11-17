import { access } from "node:fs/promises";
import path from "node:path";
import { rpc } from "./rpc.ts";
import { runKoinon } from "./run-cli.ts";

const members = 12;

async function main(): Promise<void> {
  const home = process.env.KOINON_HOME ?? ".koinon";
  const config = path.join(home, "config.json");
  try {
    await access(config);
    console.log("Fund already on this machine. Seed left it in place.");
    return;
  } catch {
    // A missing config is the first run.
  }
  await waitFor(`${process.env.KOINON_COORDINATOR ?? "http://127.0.0.1:8787"}/v1/health`, true);
  try {
    await rpc("createwallet", [process.env.BITCOIN_RPC_WALLET ?? "bootstrap"]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("already exists")) throw error;
  }
  const address = String(await rpc("getnewaddress", [], true));
  await rpc("generatetoaddress", [101, address], true);
  console.log("network: regtest");
  console.log("regtest sats have no value");
  const created = await command(["init-fund", "--name", "Dahira Démo", "--csv", "10", "--fee-cap", "100000"]);
  console.log(created.trim());
  for (let index = 1; index <= members; index += 1) {
    const added = await command(["member", "add", `membre-${String(index).padStart(2, "0")}`]);
    console.log(added.trim());
  }
  for (let index = 1; index <= members; index += 1) {
    const sent = await command(["contribute", `membre-${String(index).padStart(2, "0")}`, "5000"]);
    console.log(sent.trim());
  }
  const mined = await command(["mine", "1"]);
  console.log(mined.trim());
  console.log(`${members} members. Each contribution is 5000 XOF. Confirmations: 1.`);
}

async function command(args: string[]): Promise<string> {
  const result = await runKoinon(args);
  if (result.code !== 0) throw new Error(result.out.trim());
  return result.out;
}

async function waitFor(url: string, requireOk: boolean): Promise<void> {
  let last = url;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const body = (await response.json()) as { ok?: boolean };
        if (!requireOk || body.ok === true) return;
        last = "bitcoind not ready";
      }
    } catch (error) {
      last = error instanceof Error ? error.message : url;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(last);
}

await main();
