import { mkdirSync } from "node:fs";
import path from "node:path";
import { bitcoinRpc } from "./bitcoin.js";
import { buildApp } from "./app.js";
import { openDatabase } from "./db.js";

const port = Number(process.env.PORT ?? 8787);
const dbPath = process.env.KOINON_DB ?? "data/koinon.sqlite";
if (dbPath !== ":memory:") {
  mkdirSync(path.dirname(dbPath), { recursive: true });
}
const app = buildApp({
  db: openDatabase(dbPath),
  bitcoin: bitcoinRpc({
    url: process.env.BITCOIN_RPC_URL ?? "http://127.0.0.1:18445",
    user: process.env.BITCOIN_RPC_USER ?? "koinon",
    password: process.env.BITCOIN_RPC_PASSWORD ?? "koinon",
  }),
  pricesUrl: process.env.MEMPOOL_PRICES_URL ?? "https://mempool.space/api/v1/prices",
  logger: { level: process.env.LOG_LEVEL ?? "info" },
});

await app.listen({ port, host: process.env.HOST ?? "127.0.0.1" });
