import { payments } from "bitcoinjs-lib";
import { describe, expect, it } from "vitest";
import { accountFromMnemonic, accountPubkey, bitcoinNetwork, mnemonicFromEntropy, type Role } from "@koinon/core";
import { buildApp } from "../src/app.js";
import type { BitcoinClient } from "../src/bitcoin.js";
import { openDatabase } from "../src/db.js";
import type { DemoWallet } from "../src/demo.js";

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
