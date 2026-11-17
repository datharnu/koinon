import { createWriteStream } from "node:fs";
import { appendFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { buildApp } from "../apps/coordinator/src/app.ts";
import { bitcoinRpc } from "../apps/coordinator/src/bitcoin.ts";
import { openDatabase } from "../apps/coordinator/src/db.ts";
import { startLocalRelay } from "../packages/nostr/src/local-relay.ts";
import { startPriceFixture } from "./price-fixture.ts";
import { root } from "./run-cli.ts";
import { startRegtest } from "./regtest.ts";

const home = path.join(root, ".koinon-e2e");
const logDir = path.join(root, ".e2e");
const dbPath = path.join(logDir, "koinon.sqlite");
const logPath = path.join(logDir, "coordinator.log");
const port = 8807;

async function main(): Promise<void> {
  await rm(home, { recursive: true, force: true });
  await rm(logDir, { recursive: true, force: true });
  await mkdir(logDir, { recursive: true });
  console.log("network: regtest");
  console.log("regtest sats have no value");
  console.log("rate: fixture 60000 EUR, not a market price");
  const regtest = await startRegtest(root);
  const relay = await startLocalRelay();
  const fixture = await startPriceFixture();
  const log = createWriteStream(logPath);
  const app = buildApp({
    db: openDatabase(dbPath),
    bitcoin: bitcoinRpc({ url: "http://127.0.0.1:18445", user: "koinon", password: "koinon" }),
    pricesUrl: fixture.url,
    logger: { level: "info", stream: log },
  });
  const env = {
    ...process.env,
    KOINON_HOME: home,
    KOINON_DB: dbPath,
    KOINON_COORDINATOR: `http://127.0.0.1:${port}`,
    KOINON_RELAY: relay.url,
    KOINON_PIN: "demo-pin-1",
    KOINON_LOG: logPath,
    KOINON_RATE_SOURCE: "fixture",
    BITCOIN_RPC_URL: "http://127.0.0.1:18445",
    BITCOIN_RPC_USER: "koinon",
    BITCOIN_RPC_PASSWORD: "koinon",
    BITCOIN_RPC_WALLET: "bootstrap",
  };
  try {
    await app.listen({ port, host: "127.0.0.1" });
    const seeded = await tsx("scripts/seed.ts", env);
    console.log(seeded.out.trim());
    await appendFile(logPath, seeded.out);
    await new Promise<void>((resolve) => {
      log.write("\n", () => resolve());
    });
    if (seeded.code !== 0) {
      process.exitCode = 1;
      return;
    }
    const proved = await tsx("scripts/e2e.ts", env);
    console.log(proved.out.trim());
    if (proved.code !== 0) process.exitCode = proved.code;
  } finally {
    await app.close();
    log.end();
    await fixture.close();
    await relay.close();
    await regtest.stop();
  }
}

function tsx(script: string, env: NodeJS.ProcessEnv): Promise<{ code: number; out: string }> {
  const bin = path.join(root, "node_modules/.bin/tsx");
  return new Promise((resolve, reject) => {
    const child = spawn(bin, [path.join(root, script)], { cwd: root, env });
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

await main();
