import {
  accountFromMnemonic,
  accountPubkey,
  compileFundPolicy,
  createFundPsbt,
  mnemonicFromEntropy,
  p2wpkhAddress,
  type PolicyKeys,
} from "@koinon/core";
import { decideSpend } from "./decide.js";
import { startLocalRelay } from "./local-relay.js";
import { createIdentity, openPool, publishMessage, readMessages } from "./transport.js";
import type { SpendRequestMessage } from "./schema.js";

function entropy(byte: number): Uint8Array {
  return new Uint8Array(16).fill(byte);
}

function fundKeys(): PolicyKeys {
  return {
    officers: [
      accountFromMnemonic(mnemonicFromEntropy(entropy(0x11)), "O1", "regtest"),
      accountFromMnemonic(mnemonicFromEntropy(entropy(0x22)), "O2", "regtest"),
      accountFromMnemonic(mnemonicFromEntropy(entropy(0x33)), "O3", "regtest"),
    ],
    assembly: accountFromMnemonic(mnemonicFromEntropy(entropy(0x44)), "K", "regtest"),
    csvBlocks: 10,
  };
}

function address(byte: number): string {
  const account = accountFromMnemonic(mnemonicFromEntropy(entropy(byte)), "O1", "regtest");
  return p2wpkhAddress(accountPubkey(account.xpub, "regtest"), "regtest");
}

function watch(lines: string[]): { text: () => string; restore: () => void } {
  const writes: string[] = [];
  const methods = ["log", "info", "debug", "warn", "error"] as const;
  const previous = methods.map((method) => console[method]);
  for (const method of methods) {
    console[method] = (...args: unknown[]) => {
      writes.push(args.map((item) => String(item)).join(" "));
    };
  }
  return {
    text: () => `${writes.join("\n")}\n${lines.join("\n")}`,
    restore: () => {
      methods.forEach((method, index) => {
        const original = previous[index];
        if (original) console[method] = original;
      });
    },
  };
}

export async function proveNostr(): Promise<{ ok: boolean; lines: string[] }> {
  const lines: string[] = [];
  const note = (ok: boolean, label: string, detail: string) => {
    lines.push(`${ok ? "PASS" : "FAIL"} ${label}: ${detail}`);
  };
  const fund = fundKeys();
  const recipient = address(0x55);
  const swapped = address(0x66);
  const change = compileFundPolicy(fund, 0, "regtest", 1).address;
  const input = { txid: "ab".repeat(32), vout: 0, value: 50_000n, change: 0 as const, index: 0 };
  const honest = createFundPsbt({
    network: "regtest",
    keys: fund,
    inputs: [input],
    outputs: [
      { address: recipient, value: 40_000n },
      { address: change, value: 9_000n },
    ],
    mode: "path-a",
  }).toBase64();
  const tampered = createFundPsbt({
    network: "regtest",
    keys: fund,
    inputs: [input],
    outputs: [
      { address: swapped, value: 40_000n },
      { address: change, value: 9_000n },
    ],
    mode: "path-a",
  }).toBase64();
  const now = new Date("2026-11-17T12:00:00.000Z");
  const request: SpendRequestMessage = {
    type: "koinon.spend_request.v1",
    request_id: "11111111-1111-4111-8111-111111111111",
    fund_id: "22222222-2222-4222-8222-222222222222",
    amount_xof: 1000,
    amount_sats: "40000",
    recipient,
    purpose: "SECRET-PURPOSE-XQ",
    expires_at: "2026-11-18T12:00:00.000Z",
    coordinator_url: "http://127.0.0.1:8787",
    path: "A",
  };
  const relay = await startLocalRelay();
  const pool = openPool();
  const sender = createIdentity();
  const approver = createIdentity();
  const seen = watch(lines);
  let fetches = 0;
  try {
    await publishMessage({
      pool,
      relayUrl: relay.url,
      sender: sender.secretKey,
      recipientPublicKey: approver.publicKey,
      message: request,
    });
    const delivered = await readMessages({ pool, relayUrl: relay.url, recipient: approver });
    const got = delivered.find((item) => item.kind === "request");
    note(got?.kind === "request" && got.message.request_id === request.request_id, "deliver", got?.kind ?? "missing");
    const wire = relay.events.map((event) => event.content).join("\n");
    note(!wire.includes("koinon.spend_request") && !wire.includes("SECRET-PURPOSE-XQ"), "ciphertext", "request text is not on the relay");

    const fundView = { network: "regtest" as const, keys: fund, feeCap: 5_000n, memberIndexes: [0] };
    const refused = await decideSpend({
      message: request,
      now,
      coordinatorUrl: request.coordinator_url,
      officer: "O2",
      mnemonic: mnemonicFromEntropy(entropy(0x22)),
      fund: fundView,
      loadPsbt: async () => {
        fetches += 1;
        return tampered;
      },
    });
    note(refused.action === "refused" && refused.code === "PSBT_MISMATCH", "tamper", refused.action === "refused" ? refused.code : refused.action);
    note(refused.action !== "approve", "no approval on tamper", refused.action);

    const approved = await decideSpend({
      message: request,
      now,
      coordinatorUrl: request.coordinator_url,
      officer: "O2",
      mnemonic: mnemonicFromEntropy(entropy(0x22)),
      fund: fundView,
      loadPsbt: async () => honest,
    });
    if (approved.action === "approve") {
      const body = JSON.stringify(approved.message);
      note(!body.includes("psbt") && !body.includes(honest.slice(0, 24)), "approval body", "no psbt");
      await publishMessage({
        pool,
        relayUrl: relay.url,
        sender: approver.secretKey,
        recipientPublicKey: sender.publicKey,
        message: approved.message,
      });
      const back = await readMessages({ pool, relayUrl: relay.url, recipient: sender });
      note(back.some((item) => item.kind === "approval" && item.message.officer === "O2"), "approval delivered", "O2");
      await publishMessage({
        pool,
        relayUrl: relay.url,
        sender: approver.secretKey,
        recipientPublicKey: sender.publicKey,
        message: {
          type: "koinon.spend_rejection.v1",
          request_id: request.request_id,
          fund_id: request.fund_id,
          officer: "O2",
          reason: "pas maintenant",
        },
      });
      const rejected = await readMessages({ pool, relayUrl: relay.url, recipient: sender });
      note(
        rejected.some((item) => item.kind === "rejection" && item.message.reason === "pas maintenant"),
        "rejection delivered",
        "O2",
      );
    } else {
      note(false, "approval delivered", approved.action === "refused" ? approved.code : approved.reason);
    }

    const unknownRaw = JSON.stringify({ type: "chat.hello", text: "bonjour" });
    const { wrapEvent } = await import("nostr-tools/nip17");
    await Promise.all(pool.publish([relay.url], wrapEvent(sender.secretKey, { publicKey: approver.publicKey }, unknownRaw)));
    const mixed = await readMessages({ pool, relayUrl: relay.url, recipient: approver });
    note(mixed.some((item) => item.kind === "ignored" && item.reason === "unknown"), "unknown ignored", "unknown");

    let expiredFetches = 0;
    const expired = await decideSpend({
      message: { ...request, expires_at: "2026-11-17T11:00:00.000Z" },
      now,
      coordinatorUrl: request.coordinator_url,
      officer: "O2",
      mnemonic: mnemonicFromEntropy(entropy(0x22)),
      fund: fundView,
      loadPsbt: async () => {
        expiredFetches += 1;
        return honest;
      },
    });
    note(expired.action === "ignored" && expired.reason === "expired" && expiredFetches === 0, "expired ignored", expired.action === "ignored" ? expired.reason : expired.action);

    const redirected = await decideSpend({
      message: { ...request, coordinator_url: "http://evil.example/v1" },
      now,
      coordinatorUrl: "http://127.0.0.1:8787",
      officer: "O2",
      mnemonic: mnemonicFromEntropy(entropy(0x22)),
      fund: fundView,
      loadPsbt: async () => honest,
    });
    note(
      redirected.action === "ignored" && redirected.reason === "wrong-coordinator",
      "other coordinator ignored",
      redirected.action === "ignored" ? redirected.reason : redirected.action,
    );
    const wireAfter = relay.events.map((event) => event.content).join("\n");
    note(!wireAfter.includes("pas maintenant"), "rejection ciphertext", "reason is not on the relay");

    const logged = seen.text();
    const secret = Buffer.from(sender.secretKey).toString("hex");
    note(
      !logged.includes(secret) && !logged.includes("nsec") && !logged.includes("SECRET-PURPOSE-XQ") && !logged.includes(honest.slice(0, 32)),
      "logs",
      "no secret, purpose, or psbt",
    );
    note(fetches === 1, "tamper fetched once", String(fetches));
    lines.unshift(`relay: ${relay.url}`);
    return { ok: lines.every((line) => !line.startsWith("FAIL")), lines };
  } finally {
    seen.restore();
    pool.destroy();
    await relay.close();
  }
}
