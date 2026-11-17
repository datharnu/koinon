import { chownSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { decryptKey, type EncryptedKey } from "../packages/core/src/keystore.ts";
import { giftWrapContents, openPool, readMessages } from "../packages/nostr/src/transport.ts";
import { rpc } from "./rpc.ts";
import { runKoinon } from "./run-cli.ts";

interface Item {
  ok: boolean;
  label: string;
  detail: string;
}

const items: Item[] = [];
let shown = "";

function show(text: string): void {
  shown += text;
  console.log(text.trim());
}

async function main(): Promise<void> {
  const home = required("KOINON_HOME");
  const coordinator = required("KOINON_COORDINATOR");
  const relay = required("KOINON_RELAY");
  const config = JSON.parse(readFileSync(path.join(home, "config.json"), "utf8")) as {
    fundId: string;
    officers: { O1: { nostrPub: string }; O2: { nostrPub: string } };
  };
  const treasurer = await secret(home, "O1");
  const secretary = await secret(home, "O2");
  const word = treasurer.mnemonic.split(" ")[0] ?? "";
  const wordFile = process.env.KOINON_SCAN_WORD;
  if (wordFile) writeScanWord(wordFile, word);
  console.log("network: regtest");
  console.log("regtest sats have no value");
  if (process.env.KOINON_RATE_SOURCE === "fixture") {
    console.log("rate source: local fixture, not a market price");
  }

  const fund = await get(`${coordinator}/v1/funds/${config.fundId}`);
  const members = await get(`${coordinator}/v1/funds/${config.fundId}/members`);
  const ledger = await get(`${coordinator}/v1/funds/${config.fundId}/ledger`);
  const memberCount = Array.isArray(members.members) ? members.members.length : 0;
  const contributions = Array.isArray(ledger.entries)
    ? ledger.entries.filter((entry) => (entry as { kind?: string }).kind === "contribution").length
    : 0;
  record(
    memberCount === 12 && contributions >= 12 && typeof fund.balance_sats === "string" && fund.balance_sats !== "0",
    "fund created, 12 members, contributions visible in ledger",
    `${memberCount} members, ${contributions} contributions, ${String(fund.balance_sats)} sats`,
  );

  const dest = String(await rpc("getnewaddress", [], true));
  const requested = await runKoinon(["request", "1000", dest, "fournitures", "--as", "O1"]);
  show(requested.out);
  const requestId = requested.out.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? "";
  const request = requestId ? await get(`${coordinator}/v1/requests/${requestId}`) : {};
  record(
    requested.code === 0 && request.amount_sats === "2541" && request.rate_btc_eur === "60000",
    "request created, rate locked, sats fixed",
    `sats ${String(request.amount_sats)} eur ${String(request.rate_btc_eur)}`,
  );

  const wraps = await wrapsFor(relay, config.officers.O2.nostrPub);
  const delivered = await inbox(relay, secretary.nostrSecret, config.officers.O2.nostrPub);
  const requestDelivered =
    delivered.some((item) => item.kind === "request" && item.message.request_id === requestId) &&
    wraps.length > 0 &&
    wraps.every((content) => !content.includes("fournitures") && !content.includes("koinon.spend_request"));

  const tamper = await runKoinon(["attack", "tamper", requestId, "--as", "O2"]);
  show(tamper.out);
  record(tamper.code === 0 && tamper.out.includes("PSBT_MISMATCH"), "tampered PSBT refused by approver (PSBT_MISMATCH)", tamper.code === 0 ? "refused" : "exit");

  const single = await runKoinon(["attack", "single-sig", requestId, "--as", "O1"]);
  show(single.out);
  record(
    single.code === 0 && single.out.includes("Signature must be zero"),
    "single-signature tx rejected by bitcoind",
    single.code === 0 ? "NULLFAIL" : "exit",
  );

  const first = await runKoinon(["approve", requestId, "--as", "O1"]);
  const second = await runKoinon(["approve", requestId, "--as", "O2"]);
  show(first.out);
  show(second.out);
  const approvals = await inbox(relay, treasurer.nostrSecret, config.officers.O1.nostrPub);
  const approvalWraps = await wrapsFor(relay, config.officers.O1.nostrPub);
  const approvalDelivered = approvals.some((item) => item.kind === "approval" && item.message.request_id === requestId);
  record(
    requestDelivered && approvalDelivered && approvalWraps.every((content) => !content.includes("koinon.spend_approval")),
    "Nostr request delivered and approval received via the relay",
    requestDelivered && approvalDelivered ? "gift wrap, plaintext not on the relay" : "missing",
  );

  const broadcast = await runKoinon(["broadcast", requestId]);
  show(broadcast.out);
  const mined = await runKoinon(["mine", "1"]);
  const after = await runKoinon(["status"]);
  show(mined.out);
  show(after.out);
  record(
    broadcast.code === 0 && after.code === 0 && after.out.includes("spend"),
    "2-of-3 tx accepted and confirmed; ledger updated",
    broadcast.out.trim().split("\n")[0] ?? "",
  );

  const other = await runKoinon(["request", "1000", dest, "autre", "--as", "O1"]);
  show(other.out);
  const otherId = other.out.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? "";
  expire(otherId);
  const expiredSign = await runKoinon(["approve", otherId, "--as", "O2"]);
  const expiredBroadcast = await runKoinon(["broadcast", otherId]);
  show(expiredSign.out);
  show(expiredBroadcast.out);
  record(
    expiredSign.code !== 0 &&
      expiredSign.out.includes("REFUS expired") &&
      expiredBroadcast.code !== 0 &&
      expiredBroadcast.out.includes("REQUEST_EXPIRED"),
    "expired request cannot be signed or broadcast",
    "officer refused before signing; broadcast REQUEST_EXPIRED",
  );

  const early = await runKoinon(["recover", dest, "--as", "O3"]);
  show(early.out);
  const waited = await runKoinon(["mine", "10"]);
  const late = await runKoinon(["recover", dest, "--as", "O3"]);
  show(waited.out);
  show(late.out);
  record(
    early.code === 0 && early.out.includes("non-BIP68-final") && late.code === 0 && late.out.includes("Récupération acceptée"),
    "recovery path before N rejected (non-BIP68-final); after mining N, accepted",
    "N = 10",
  );

  const intact = await runKoinon(["audit", "verify"]);
  tamperAudit();
  const broken = await runKoinon(["audit", "verify"]);
  show(intact.out);
  show(broken.out);
  record(
    intact.code === 0 && intact.out.includes("Audit intact") && broken.code !== 0,
    "audit chain verifies; tampering one row makes verify fail",
    broken.out.trim().split("\n")[0] ?? "broken",
  );

  const logPath = process.env.KOINON_LOG;
  if (logPath) {
    const text = `${readFileSync(logPath, "utf8")}\n${shown}`;
    const hit = leak(text, word);
    record(
      hit === null,
      "log scan: no pseudonyms, xprv, seed words, nsec, or PSBT base64 in the coordinator log or command output",
      hit ?? "clean",
    );
  }

  let failed = false;
  for (const item of items) {
    console.log(`${item.ok ? "[x]" : "[ ]"} ${item.label}${item.ok ? "" : ` — ${item.detail}`}`);
    if (!item.ok) failed = true;
  }
  if (failed) process.exitCode = 1;
}

function record(ok: boolean, label: string, detail: string): void {
  items.push({ ok, label, detail });
}

async function get(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url);
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof body.code === "string" ? body.code : String(response.status));
  return body;
}

async function inbox(relay: string, secretKey: Uint8Array, publicKey: string) {
  const pool = openPool();
  try {
    return await readMessages({ pool, relayUrl: relay, recipient: { secretKey, publicKey } });
  } finally {
    pool.destroy();
  }
}

async function wrapsFor(relay: string, publicKey: string): Promise<string[]> {
  const pool = openPool();
  try {
    return await giftWrapContents({ pool, relayUrl: relay, recipientPublicKey: publicKey });
  } finally {
    pool.destroy();
  }
}

async function secret(home: string, role: string): Promise<{ mnemonic: string; nostrSecret: Uint8Array }> {
  const file = JSON.parse(readFileSync(path.join(home, "keys", `${role}.json`), "utf8")) as EncryptedKey;
  const pin = required("KOINON_PIN");
  const plain = JSON.parse(new TextDecoder().decode(await decryptKey(file, pin))) as { mnemonic: string; nostrSecretHex: string };
  return { mnemonic: plain.mnemonic, nostrSecret: Buffer.from(plain.nostrSecretHex, "hex") };
}

function expire(id: string): void {
  const db = openDb();
  try {
    db.prepare("UPDATE requests SET expires_at = ? WHERE id = ?").run(new Date(Date.now() - 60_000).toISOString(), id);
  } finally {
    db.close();
  }
}

function tamperAudit(): void {
  const db = openDb();
  try {
    db.prepare("UPDATE audit SET detail = detail || 'x' WHERE seq = 1").run();
  } finally {
    db.close();
  }
}

function openDb(): DatabaseSync {
  const db = new DatabaseSync(required("KOINON_DB"));
  db.exec("PRAGMA busy_timeout = 5000");
  return db;
}

function leak(text: string, word: string): string | null {
  if (text.includes("xprv") || text.includes("tprv")) return "xprv";
  if (text.includes("nsec1")) return "nsec";
  if (text.includes("cHNidP")) return "psbt";
  if (text.includes("membre-")) return "pseudonym";
  const pin = process.env.KOINON_PIN ?? "";
  if (pin.length > 0 && text.includes(pin)) return "pin";
  if (word.length > 0 && leaksWord(text, word)) return "seed word";
  return null;
}

function leaksWord(text: string, word: string): boolean {
  if (!/^[0-9a-f]+$/i.test(word)) return text.includes(word);
  return new RegExp(`(^|[^0-9a-fA-F])${word}([^0-9a-fA-F]|$)`).test(text);
}

// The container runs as root but the host log scan runs as the bind mount's owner (the CI runner user),
// so the file is handed to that owner while staying unreadable to anyone else.
function writeScanWord(file: string, word: string): void {
  writeFileSync(file, word, { mode: 0o600 });
  const owner = statSync(path.dirname(file));
  if (process.getuid?.() === 0 && owner.uid !== 0) chownSync(file, owner.uid, owner.gid);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing`);
  return value;
}

await main();
