import {
  accountPubkey,
  AUTH_SKEW_MS,
  authPayload,
  compileFundPolicy,
  ErrorCode,
  fundDescriptor,
  KoinonError,
  verifyAuth,
  xofForSats,
  type Role,
} from "@koinon/core";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { verifyAudit, type AuditRow } from "./audit.js";
import { appendAudit } from "./audit.js";
import type { BitcoinClient } from "./bitcoin.js";
import { withTx } from "./db.js";
import type { DemoWallet } from "./demo.js";
import { balanceSats, fundById, fundKeys, xpubFor, type FundRow } from "./funds.js";
import { fetchBtcEur, RateCache, type RateSnapshot } from "./rate.js";
import { addSignature, broadcastRequest, createRequest, rejectRequest, requestById } from "./requests.js";
import { markRescan, scanChain } from "./scan.js";

export interface AppDeps {
  db: DatabaseSync;
  bitcoin: BitcoinClient;
  fetchEur?: () => Promise<string>;
  now?: () => Date;
  logger?: boolean | { level?: string; stream?: { write: (message: string) => void } };
  pricesUrl?: string;
  /** Regtest faucet and miner for the browser demo. Absent unless KOINON_DEMO=1. */
  demo?: DemoWallet;
}

const writeLimit = { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } };
const officerRoles = ["O1", "O2", "O3", "K"] as const;

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = buildServer(deps);
  app.decorate("db", deps.db);
  return app;
}

function buildServer(deps: AppDeps): FastifyInstance {
  const now = () => deps.now?.() ?? new Date();
  const rates = new RateCache(
    deps.fetchEur ?? (() => fetchBtcEur(deps.pricesUrl ?? "https://mempool.space/api/v1/prices")),
    () => now().getTime(),
  );
  const app = Fastify({
    bodyLimit: 128 * 1024,
    logger: loggerOptions(deps.logger),
  });
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
    const text = typeof body === "string" ? body : "";
    (_request as FastifyRequest & { rawBody?: string }).rawBody = text;
    try {
      done(null, text.length === 0 ? {} : JSON.parse(text));
    } catch {
      done(new KoinonError(ErrorCode.VALIDATION, "invalid json"), undefined);
    }
  });
  app.register(helmet);
  app.register(rateLimit, { global: false });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof KoinonError) {
      reply.status(statusFor(error.code)).send({ code: error.code, message: error.message });
      return;
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      reply.status(status).send({ code: "VALIDATION", message: "request rejected" });
      return;
    }
    request.log.error({ name: error instanceof Error ? error.name : "Error" });
    reply.status(500).send({ code: "VALIDATION", message: "internal error" });
  });

  app.get("/v1/health", async () => {
    let bitcoind = false;
    try {
      await deps.bitcoin.getBlockCount();
      bitcoind = true;
    } catch {
      bitcoind = false;
    }
    return { ok: bitcoind, network: "regtest", bitcoind, demo: deps.demo !== undefined };
  });

  app.post("/v1/tx", writeLimit, async (request) => {
    const body = z.object({ hex: z.string().regex(/^[0-9a-f]+$/i).min(20).max(200_000) }).safeParse(request.body);
    if (!body.success) throw new KoinonError(ErrorCode.VALIDATION, "invalid transaction hex");
    try {
      const txid = await deps.bitcoin.sendRawTransaction(body.data.hex);
      return { txid };
    } catch (error) {
      const message = error instanceof Error ? error.message : "the node rejected the transaction";
      throw new KoinonError(ErrorCode.NODE_REJECTED, message);
    }
  });

  if (deps.demo) {
    const demo = deps.demo;
    app.post("/v1/demo/faucet", writeLimit, async (request) => {
      const body = z
        .object({ address: z.string().min(10).max(120), sats: z.string().regex(/^[1-9]\d{0,6}$/) })
        .safeParse(request.body);
      if (!body.success) throw new KoinonError(ErrorCode.VALIDATION, "invalid faucet request");
      const member = deps.db.prepare("SELECT 1 FROM members WHERE address = ?").get(body.data.address);
      if (!member) throw new KoinonError(ErrorCode.VALIDATION, "the faucet only pays Koinon member addresses");
      const sats = BigInt(body.data.sats);
      if (sats > 2_000_000n) throw new KoinonError(ErrorCode.VALIDATION, "the faucet pays at most 2,000,000 sats");
      const txid = await demo.pay(body.data.address, sats);
      return { txid, network: "regtest", regtest_sats_have_no_value: true };
    });

    app.post("/v1/demo/mine", writeLimit, async (request) => {
      const body = z.object({ blocks: z.number().int().min(1).max(20) }).safeParse(request.body);
      if (!body.success) throw new KoinonError(ErrorCode.VALIDATION, "mine 1 to 20 blocks");
      const height = await demo.mine(body.data.blocks);
      return { height, network: "regtest" };
    });
  }

  app.get("/v1/rate", async (request) => {
    const rate = await rates.current();
    if (queryFlag(request, "require_fresh") && rate.stale) {
      throw new KoinonError(ErrorCode.RATE_STALE, "the btc/xof rate is stale");
    }
    return rate;
  });

  app.post("/v1/funds", writeLimit, async (request, reply) => {
    const body = fundSchema.safeParse(request.body);
    if (!body.success) throw new KoinonError(ErrorCode.VALIDATION, "invalid fund");
    const input = body.data;
    for (const officer of [...input.officers, input.assembly]) {
      try {
        accountPubkey(officer.xpub, "regtest");
      } catch {
        throw new KoinonError(ErrorCode.VALIDATION, "invalid xpub for this network");
      }
    }
    const roles = new Set(input.officers.map((officer) => officer.role));
    if (roles.size !== 3) throw new KoinonError(ErrorCode.VALIDATION, "officers must be O1, O2 and O3");
    const byRole = Object.fromEntries(input.officers.map((officer) => [officer.role, officer])) as Record<
      "O1" | "O2" | "O3",
      { role: "O1" | "O2" | "O3"; label: string; xpub: string }
    >;
    const keys = fundKeys({
      officer_xpub_o1: byRole.O1.xpub,
      officer_xpub_o2: byRole.O2.xpub,
      officer_xpub_o3: byRole.O3.xpub,
      assembly_xpub: input.assembly.xpub,
      csv_blocks: input.csv_blocks,
    } as FundRow);
    const change = compileFundPolicy(keys, 0, "regtest", 1);
    const id = crypto.randomUUID();
    const createdAt = now().toISOString();
    withTx(deps.db, () => {
      deps.db
        .prepare(
          `INSERT INTO funds (
            id, name, network, csv_blocks, fee_cap_sats,
            officer_label_o1, officer_xpub_o1, officer_label_o2, officer_xpub_o2,
            officer_label_o3, officer_xpub_o3, assembly_label, assembly_xpub,
            descriptor, change_address, change_script, created_at
          ) VALUES (?, ?, 'regtest', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.name,
          input.csv_blocks,
          input.fee_cap_sats,
          byRole.O1.label,
          byRole.O1.xpub,
          byRole.O2.label,
          byRole.O2.xpub,
          byRole.O3.label,
          byRole.O3.xpub,
          input.assembly.label,
          input.assembly.xpub,
          fundDescriptor(keys),
          change.address,
          Buffer.from(change.scriptPubKey).toString("hex"),
          createdAt,
        );
      appendAudit(deps.db, id, "system", "fund.create", null, { csv_blocks: input.csv_blocks }, createdAt);
    });
    reply.status(201);
    return { id, change_address: change.address };
  });

  app.get("/v1/funds/:id", async (request) => {
    const fund = fundById(deps.db, routeId(request));
    const { rate, tip } = await refresh();
    const sats = balanceSats(deps.db, fund.id);
    return {
      ...publicFund(fund),
      balance_sats: sats.toString(),
      balance_xof: rate.btc_eur ? xofForSats(sats, rate.btc_eur).toString() : null,
      chain_tip: tip,
      rate,
    };
  });

  app.get("/v1/funds/:id/members", async (request) => {
    const fund = fundById(deps.db, routeId(request));
    const rows = deps.db
      .prepare("SELECT idx, pseudonym, address, created_at FROM members WHERE fund_id = ? ORDER BY idx")
      .all(fund.id) as { idx: number; pseudonym: string; address: string; created_at: string }[];
    return { members: rows.map((row) => ({ index: row.idx, pseudonym: row.pseudonym, address: row.address, created_at: row.created_at })) };
  });

  app.post("/v1/funds/:id/members", writeLimit, async (request, reply) => {
    const fund = fundById(deps.db, routeId(request));
    const body = z.object({ pseudonym: z.string().trim().min(1).max(40) }).safeParse(request.body);
    if (!body.success) throw new KoinonError(ErrorCode.VALIDATION, "invalid member");
    const keys = fundKeys(fund);
    const next = deps.db.prepare("SELECT COALESCE(MAX(idx), -1) + 1 AS idx FROM members WHERE fund_id = ?").get(fund.id) as {
      idx: number;
    };
    const policy = compileFundPolicy(keys, next.idx, "regtest", 0);
    const createdAt = now().toISOString();
    withTx(deps.db, () => {
      deps.db
        .prepare("INSERT INTO members (fund_id, idx, pseudonym, address, script, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(fund.id, next.idx, body.data.pseudonym, policy.address, Buffer.from(policy.scriptPubKey).toString("hex"), createdAt);
      markRescan(deps.db);
      appendAudit(deps.db, fund.id, "system", "member.add", null, { index: next.idx }, createdAt);
    });
    reply.status(201);
    return { index: next.idx, address: policy.address };
  });

  app.get("/v1/funds/:id/ledger", async (request) => {
    const fund = fundById(deps.db, routeId(request));
    const { tip } = await refresh();
    const limit = boundedInt(request, "limit", 50, 100);
    const offset = boundedInt(request, "offset", 0, 100_000);
    const rows = deps.db
      .prepare(
        `SELECT kind, txid, vout, idx, sats, xof, block_height, seen_at, fee, request_id FROM (
           SELECT 'contribution' AS kind, txid, vout, idx, sats, xof_at_receipt AS xof, block_height, seen_at,
                  NULL AS fee, NULL AS request_id
           FROM utxos WHERE fund_id = ? AND change = 0
           UNION ALL
           SELECT 'spend', txid, NULL, NULL, sats_out, xof_at_spend, block_height, seen_at, fee_sats, request_id
           FROM spends WHERE fund_id = ?
         ) AS ledger ORDER BY seen_at DESC LIMIT ? OFFSET ?`,
      )
      .all(fund.id, fund.id, limit, offset) as unknown as LedgerRow[];
    const more = rows.length === limit;
    return {
      entries: rows.map((row) => ({
        kind: row.kind,
        txid: row.txid,
        vout: row.vout,
        index: row.idx,
        sats: row.sats,
        xof_at_receipt: row.xof,
        fee_sats: row.fee,
        request_id: row.request_id,
        confirmations: row.block_height < 0 ? 0 : tip - row.block_height + 1,
        seen_at: row.seen_at,
      })),
      next_offset: more ? offset + limit : null,
    };
  });

  app.post("/v1/funds/:id/requests", writeLimit, async (request, reply) => {
    const fund = fundById(deps.db, routeId(request));
    const body = requestSchema.safeParse(request.body);
    if (!body.success) throw new KoinonError(ErrorCode.VALIDATION, "invalid spend request");
    const role = authenticate(request, fund, now());
    if (role !== body.data.role) throw new KoinonError(ErrorCode.SIG_INVALID, "auth role does not match the request");
    const { rate, tip } = await refresh();
    const created = createRequest({
      db: deps.db,
      fund,
      role,
      recipient: body.data.recipient,
      purpose: body.data.purpose,
      amountXof: BigInt(body.data.amount_xof),
      path: body.data.path,
      rate,
      requireFresh: queryFlag(request, "require_fresh"),
      tip,
      now: now(),
    });
    reply.status(201);
    return publicRequest(deps.db, created.id);
  });

  app.get("/v1/requests/:id", async (request) => publicRequest(deps.db, routeId(request)));

  app.post("/v1/requests/:id/signatures", writeLimit, async (request) => {
    const row = requestById(deps.db, routeId(request));
    const fund = fundById(deps.db, row.fund_id);
    const role = authenticate(request, fund, now());
    const body = z.object({ psbt: z.string().min(1).max(100_000) }).safeParse(request.body);
    if (!body.success) throw new KoinonError(ErrorCode.VALIDATION, "invalid signature");
    const result = addSignature({ db: deps.db, request: row, role, psbtBase64: body.data.psbt, now: now() });
    return { id: row.id, ...result };
  });

  app.post("/v1/requests/:id/reject", writeLimit, async (request) => {
    const row = requestById(deps.db, routeId(request));
    const fund = fundById(deps.db, row.fund_id);
    const role = authenticate(request, fund, now());
    const body = z.object({ reason: z.string().trim().min(1).max(140) }).safeParse(request.body);
    if (!body.success) throw new KoinonError(ErrorCode.VALIDATION, "invalid rejection");
    rejectRequest({ db: deps.db, request: row, role, reason: body.data.reason, now: now() });
    return { id: row.id, status: "rejected" };
  });

  app.post("/v1/requests/:id/broadcast", writeLimit, async (request) => {
    const row = requestById(deps.db, routeId(request));
    const txid = await broadcastRequest({ db: deps.db, bitcoin: deps.bitcoin, request: row, now: now() });
    return { id: row.id, status: "broadcast", txid };
  });

  app.get("/v1/funds/:id/audit", async (request) => {
    const fund = fundById(deps.db, routeId(request));
    const rows = auditRows(deps.db, fund.id);
    return { entries: rows };
  });

  app.get("/v1/funds/:id/audit/verify", async (request) => {
    const fund = fundById(deps.db, routeId(request));
    return verifyAudit(auditRows(deps.db, fund.id));
  });

  async function refresh(): Promise<{ rate: RateSnapshot; tip: number }> {
    const rate = await rates.current();
    const tip = await scanChain(deps.db, deps.bitcoin, rate, now());
    return { rate, tip };
  }

  return app;
}

function authenticate(request: FastifyRequest, fund: FundRow, now: Date): Role {
  const header = request.headers.authorization;
  if (!header?.startsWith("Koinon ")) throw new KoinonError(ErrorCode.VALIDATION, "missing officer auth");
  const [role, timestampText, nonce, signature] = header.slice("Koinon ".length).split(" ");
  if (!role || !timestampText || !nonce || !signature) {
    throw new KoinonError(ErrorCode.VALIDATION, "missing officer auth");
  }
  if (!officerRoles.includes(role as Role)) throw new KoinonError(ErrorCode.VALIDATION, "unknown officer");
  const timestamp = Number(timestampText);
  if (!Number.isInteger(timestamp) || Math.abs(now.getTime() - timestamp) > AUTH_SKEW_MS) {
    throw new KoinonError(ErrorCode.VALIDATION, "auth timestamp is outside the allowed window");
  }
  if (!/^[0-9a-zA-Z_-]{8,80}$/.test(nonce)) throw new KoinonError(ErrorCode.VALIDATION, "invalid auth nonce");
  const raw = (request as FastifyRequest & { rawBody?: string }).rawBody ?? "";
  const path = new URL(request.url, "http://koinon.local").pathname;
  const payload = authPayload({
    method: request.method,
    path,
    timestamp,
    nonce,
    body: new TextEncoder().encode(raw),
  });
  const ok = verifyAuth(accountPubkey(xpubFor(fund, role as Role), "regtest"), payload, signature);
  if (!ok) throw new KoinonError(ErrorCode.SIG_INVALID, "officer signature was rejected");
  consumeNonce(request.server.db, nonce, now.getTime() + AUTH_SKEW_MS);
  return role as Role;
}

function consumeNonce(db: DatabaseSync, nonce: string, expiresAt: number): void {
  db.prepare("DELETE FROM nonces WHERE expires_at < ?").run(Date.now());
  try {
    db.prepare("INSERT INTO nonces (nonce, expires_at) VALUES (?, ?)").run(nonce, expiresAt);
  } catch {
    throw new KoinonError(ErrorCode.VALIDATION, "replayed auth nonce");
  }
}

function publicFund(fund: FundRow) {
  return {
    id: fund.id,
    name: fund.name,
    network: "regtest",
    regtest_sats_have_no_value: true,
    csv_blocks: fund.csv_blocks,
    fee_cap_sats: fund.fee_cap_sats,
    officers: [
      { role: "O1", label: fund.officer_label_o1, xpub: fund.officer_xpub_o1 },
      { role: "O2", label: fund.officer_label_o2, xpub: fund.officer_xpub_o2 },
      { role: "O3", label: fund.officer_label_o3, xpub: fund.officer_xpub_o3 },
    ],
    assembly: { role: "K", label: fund.assembly_label, xpub: fund.assembly_xpub },
    descriptor: fund.descriptor,
    change_address: fund.change_address,
    created_at: fund.created_at,
  };
}

function publicRequest(db: DatabaseSync, id: string) {
  const row = requestById(db, id);
  const approvals = db
    .prepare("SELECT officer, signed_at FROM approvals WHERE request_id = ? ORDER BY signed_at")
    .all(id) as { officer: string; signed_at: string }[];
  return {
    id: row.id,
    fund_id: row.fund_id,
    requester: row.requester,
    recipient: row.recipient,
    purpose: row.purpose,
    amount_xof: row.amount_xof,
    amount_sats: row.amount_sats,
    rate_btc_eur: row.rate_btc_eur,
    rate_btc_xof: row.rate_btc_xof,
    rate_fetched_at: row.rate_fetched_at,
    rate_stale: row.rate_stale === 1,
    fee_sats: row.fee_sats,
    change_sats: row.change_sats,
    path: row.path,
    status: row.status,
    expires_at: row.expires_at,
    created_at: row.created_at,
    broadcast_txid: row.broadcast_txid,
    approvals,
    psbt: row.psbt,
    network: "regtest",
    regtest_sats_have_no_value: true,
  };
}

function auditRows(db: DatabaseSync, fundId: string): AuditRow[] {
  return db
    .prepare(
      "SELECT seq, prev_hash, hash, at, actor, action, request_id, detail FROM audit WHERE fund_id = ? ORDER BY seq",
    )
    .all(fundId) as unknown as AuditRow[];
}

interface LedgerRow {
  kind: string;
  txid: string;
  vout: number | null;
  idx: number | null;
  sats: string;
  xof: string | null;
  block_height: number;
  seen_at: string;
  fee: string | null;
  request_id: string | null;
}

function routeId(request: FastifyRequest): string {
  const id = (request.params as { id?: string }).id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new KoinonError(ErrorCode.NOT_FOUND, "not found");
  return id;
}

function boundedInt(request: FastifyRequest, name: string, fallback: number, max: number): number {
  const raw = (request.query as Record<string, string | undefined>)[name];
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) throw new KoinonError(ErrorCode.VALIDATION, "invalid page");
  return Math.min(max, Number(raw));
}

function queryFlag(request: FastifyRequest, name: string): boolean {
  return (request.query as Record<string, string | undefined>)[name] === "1";
}

function statusFor(code: ErrorCode): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "VALIDATION":
    case "SIG_INVALID":
      return 400;
    case "PSBT_MISMATCH":
      return 422;
    case "RATE_UNAVAILABLE":
      return 503;
    default:
      return 409;
  }
}

function loggerOptions(logger: AppDeps["logger"]): boolean | object {
  const redact = ["req.headers.authorization", "req.body"];
  if (logger === false) return false;
  if (logger && typeof logger === "object") return { level: logger.level ?? "info", stream: logger.stream, redact };
  return { level: "info", redact };
}

declare module "fastify" {
  interface FastifyInstance {
    db: DatabaseSync;
  }
}

const fundSchema = z.object({
  name: z.string().trim().min(1).max(80),
  csv_blocks: z.number().int().min(1).max(65535),
  fee_cap_sats: z.string().regex(/^[1-9]\d*$/),
  officers: z
    .array(
      z.object({
        role: z.enum(["O1", "O2", "O3"]),
        label: z.string().trim().min(1).max(40),
        xpub: z.string().min(20).max(200),
      }),
    )
    .length(3),
  assembly: z.object({
    label: z.string().trim().min(1).max(40),
    xpub: z.string().min(20).max(200),
  }),
});

const requestSchema = z.object({
  role: z.enum(["O1", "O2", "O3"]),
  recipient: z.string().min(10).max(120),
  purpose: z.string().trim().min(1).max(140),
  amount_xof: z.number().int().positive().max(1_000_000_000_000),
  path: z.enum(["A", "B"]).default("A"),
});
