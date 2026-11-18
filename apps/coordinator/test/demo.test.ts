import { payments } from "bitcoinjs-lib";
import { describe, expect, it } from "vitest";
import { accountFromMnemonic, accountPubkey, bitcoinNetwork, mnemonicFromEntropy, type Role } from "@koinon/core";
import { buildApp } from "../src/app.js";
import type { BitcoinClient } from "../src/bitcoin.js";
import { openDatabase } from "../src/db.js";
import { demoWallet, type DemoWallet } from "../src/demo.js";

function xpub(byte: number, role: Role): string {
  return accountFromMnemonic(mnemonicFromEntropy(new Uint8Array(16).fill(byte)), role, "regtest").xpub;
}

function stranger(): string {
  const pubkey = accountPubkey(xpub(0x77, "O1"), "regtest");
  return payments.p2wpkh({ pubkey, network: bitcoinNetwork("regtest") }).address ?? "";
}

function node(refuse?: string): BitcoinClient {
  return {
    async getBlockCount() {
      return 0;
    },
    async getBlockHash() {
      return "h0";
    },
    async getBlockHex() {
      return Buffer.alloc(80).toString("hex");
    },
    async sendRawTransaction() {
      if (refuse) throw new Error(refuse);
      return "ab".repeat(32);
    },
    async getMempoolHex() {
      return [];
    },
    async getRawTransaction() {
      throw new Error("missing transaction");
    },
  };
}

async function post(app: ReturnType<typeof buildApp>, url: string, body: unknown) {
  const response = await app.inject({
    method: "POST",
    url,
    headers: { "content-type": "application/json" },
    payload: JSON.stringify(body),
  });
  return { status: response.statusCode, json: JSON.parse(response.body) as Record<string, unknown> };
}

describe("raw broadcast", () => {
  it("returns the node's own refusal under NODE_REJECTED", async () => {
    const refusal = "sendrawtransaction: -26 non-BIP68-final";
    const app = buildApp({ db: openDatabase(":memory:"), bitcoin: node(refusal), fetchEur: async () => "60000", logger: false });
    const refused = await post(app, "/v1/tx", { hex: "02".repeat(40) });
    expect(refused.status).toBe(409);
    expect(refused.json).toEqual({ code: "NODE_REJECTED", message: refusal });
    const invalid = await post(app, "/v1/tx", { hex: "not hex" });
    expect(invalid.json.code).toBe("VALIDATION");
  });
});

describe("demo faucet", () => {
  it("is absent unless the demo wallet is configured", async () => {
    const app = buildApp({ db: openDatabase(":memory:"), bitcoin: node(), fetchEur: async () => "60000", logger: false });
    const response = await post(app, "/v1/demo/mine", { blocks: 1 });
    expect(response.status).toBe(404);
    const health = await app.inject({ method: "GET", url: "/v1/health" });
    expect((JSON.parse(health.body) as { demo: boolean }).demo).toBe(false);
  });

  it("pays only member addresses and caps the amount", async () => {
    const paid: string[] = [];
    const demo: DemoWallet = {
      async pay(address) {
        paid.push(address);
        return "cd".repeat(32);
      },
      async mine(blocks) {
        return blocks;
      },
    };
    const app = buildApp({ db: openDatabase(":memory:"), bitcoin: node(), fetchEur: async () => "60000", logger: false, demo });
    const fund = await post(app, "/v1/funds", {
      name: "Dahira Demo",
      csv_blocks: 10,
      fee_cap_sats: "100000",
      officers: [
        { role: "O1", label: "O1", xpub: xpub(0x11, "O1") },
        { role: "O2", label: "O2", xpub: xpub(0x22, "O2") },
        { role: "O3", label: "O3", xpub: xpub(0x33, "O3") },
      ],
      assembly: { label: "K", xpub: xpub(0x44, "K") },
    });
    const member = await post(app, `/v1/funds/${String(fund.json.id)}/members`, { pseudonym: "Awa" });
    const address = String(member.json.address);

    const outsider = await post(app, "/v1/demo/faucet", { address: stranger(), sats: "1000" });
    expect(outsider.json.code).toBe("VALIDATION");
    const tooMuch = await post(app, "/v1/demo/faucet", { address, sats: "5000000" });
    expect(tooMuch.json.code).toBe("VALIDATION");
    const ok = await post(app, "/v1/demo/faucet", { address, sats: "8334" });
    expect(ok.status).toBe(200);
    expect(ok.json.regtest_sats_have_no_value).toBe(true);
    expect(paid).toEqual([address]);

    const mined = await post(app, "/v1/demo/mine", { blocks: 10 });
    expect(mined.json.height).toBe(10);
    const tooMany = await post(app, "/v1/demo/mine", { blocks: 500 });
    expect(tooMany.json.code).toBe("VALIDATION");
  });
});

describe("faucet refill", () => {
  it("mines a refill and retries sendtoaddress once when the wallet is empty", async () => {
    const calls: string[] = [];
    let sends = 0;
    const original = globalThis.fetch;
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String((init as RequestInit).body)) as { method: string };
      calls.push(body.method);
      const ok = (result: unknown) => Response.json({ result, error: null });
      if (body.method === "createwallet") return Response.json({ result: null, error: { code: -4, message: "Wallet already exists" } });
      if (body.method === "getbalance") return ok(10);
      if (body.method === "getnewaddress") return ok("bcrt1qminer");
      if (body.method === "generatetoaddress") return ok(["block"]);
      if (body.method === "sendtoaddress") {
        sends += 1;
        if (sends === 1) return Response.json({ result: null, error: { code: -6, message: "Insufficient funds" } });
        return ok("aa".repeat(32));
      }
      return ok(0);
    };
    try {
      const wallet = demoWallet({ url: "http://node", user: "koinon", password: "koinon", wallet: "faucet" });
      await expect(wallet.pay("bcrt1qmember", 1000n)).resolves.toBe("aa".repeat(32));
      expect(calls.filter((method) => method === "sendtoaddress")).toHaveLength(2);
      expect(calls.filter((method) => method === "generatetoaddress")).toHaveLength(2);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("does not mine when sendtoaddress fails for another reason", async () => {
    let sends = 0;
    const original = globalThis.fetch;
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String((init as RequestInit).body)) as { method: string };
      const ok = (result: unknown) => Response.json({ result, error: null });
      if (body.method === "createwallet") return Response.json({ result: null, error: { code: -4, message: "Wallet already exists" } });
      if (body.method === "getbalance") return ok(10);
      if (body.method === "sendtoaddress") {
        sends += 1;
        return Response.json({ result: null, error: { code: -26, message: "txn-mempool-conflict" } });
      }
      return ok("bcrt1qminer");
    };
    try {
      const wallet = demoWallet({ url: "http://node", user: "koinon", password: "koinon", wallet: "faucet" });
      await expect(wallet.pay("bcrt1qmember", 1000n)).rejects.toThrow(/txn-mempool-conflict/);
      expect(sends).toBe(1);
    } finally {
      globalThis.fetch = original;
    }
  });
});
