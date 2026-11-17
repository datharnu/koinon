import type { Role } from "@koinon/core";
import type { Runtime } from "./api.js";
import {
  addMember,
  approve,
  attackSingleSig,
  attackTamper,
  audit,
  broadcast,
  contribute,
  initFund,
  mine,
  recover,
  reject,
  requestSpend,
  status,
} from "./commands.js";
import { line, type Lang } from "./text.js";

const argv = process.argv.slice(2);
const flags: Record<string, string> = {};
const positionals: string[] = [];
for (let index = 0; index < argv.length; index += 1) {
  const token = argv[index];
  if (!token) continue;
  if (token.startsWith("--")) {
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      flags[token.slice(2)] = next;
      index += 1;
    } else {
      flags[token.slice(2)] = "true";
    }
  } else {
    positionals.push(token);
  }
}

const lang: Lang = flags.lang === "en" ? "en" : "fr";
const ctx: Runtime = {
  lang,
  ...(flags.pin ?? process.env.KOINON_PIN ? { pin: flags.pin ?? process.env.KOINON_PIN } : {}),
  coordinator: flags.coordinator ?? process.env.KOINON_COORDINATOR ?? "http://127.0.0.1:8787",
  ...(flags.relay ?? process.env.KOINON_RELAY ? { relay: flags.relay ?? process.env.KOINON_RELAY } : {}),
  rpcUrl: process.env.BITCOIN_RPC_URL ?? "http://127.0.0.1:18445",
  rpcUser: process.env.BITCOIN_RPC_USER ?? "koinon",
  rpcPassword: process.env.BITCOIN_RPC_PASSWORD ?? "koinon",
  rpcWallet: process.env.BITCOIN_RPC_WALLET ?? "bootstrap",
};

function asRole(): Role {
  const value = flags.as;
  if (value !== "O1" && value !== "O2" && value !== "O3" && value !== "K") {
    throw new Error(line(lang, "Précisez --as O1, O2, O3 ou K.", "Pass --as O1, O2, O3, or K."));
  }
  return value;
}

function need(value: string | undefined, usage: string): string {
  if (!value) throw new Error(usage);
  return value;
}

try {
  const [command, second, third, fourth] = positionals;
  if (command === "init-fund") await initFund(ctx, flags);
  else if (command === "member" && second === "add") await addMember(ctx, need(third, "member add <pseudonym>"));
  else if (command === "contribute") await contribute(ctx, need(second, "contribute <pseudonym> <xof>"), need(third, "contribute <pseudonym> <xof>"));
  else if (command === "status") await status(ctx);
  else if (command === "request") {
    await requestSpend(ctx, need(second, "request <xof> <address> <purpose>"), need(third, "request <xof> <address> <purpose>"), need(fourth, "request <xof> <address> <purpose>"), asRole());
  } else if (command === "approve") await approve(ctx, need(second, "approve <request_id>"), asRole());
  else if (command === "reject") await reject(ctx, need(second, "reject <request_id>"), asRole(), need(flags.reason, "--reason"));
  else if (command === "broadcast") await broadcast(ctx, need(second, "broadcast <request_id>"));
  else if (command === "attack" && second === "single-sig") await attackSingleSig(ctx, need(third, "attack single-sig <request_id>"), asRole());
  else if (command === "attack" && second === "tamper") await attackTamper(ctx, need(third, "attack tamper <request_id>"), asRole());
  else if (command === "recover") await recover(ctx, need(second, "recover <address>"), asRole());
  else if (command === "mine") await mine(ctx, Number(need(second, "mine <n>")));
  else if (command === "audit" && second === "verify") await audit(ctx);
  else {
    console.log(line(
      lang,
      "Commandes : init-fund, member add, contribute, status, request, approve, reject, broadcast, attack single-sig, attack tamper, recover, mine, audit verify.",
      "Commands: init-fund, member add, contribute, status, request, approve, reject, broadcast, attack single-sig, attack tamper, recover, mine, audit verify.",
    ));
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "error");
  process.exitCode = 1;
}
