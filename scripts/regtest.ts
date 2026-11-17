import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

const RPC_USER = "koinon";
const RPC_PASSWORD = "koinon";

export interface Regtest {
  port: number;
  datadir: string;
  stop: () => Promise<void>;
  rpc: (method: string, params: unknown[], wallet?: string) => Promise<unknown>;
}

export async function startRegtest(root: string): Promise<Regtest> {
  const datadir = path.join(root, ".regtest");
  const port = 18445;
  await rm(datadir, { recursive: true, force: true });
  await mkdir(datadir, { recursive: true });
  const bitcoind = process.env.BITCOIND ?? "bitcoind";
  const child = spawn(
    bitcoind,
    [
      `-datadir=${datadir}`,
      "-regtest",
      "-server",
      "-txindex",
      `-rpcuser=${RPC_USER}`,
      `-rpcpassword=${RPC_PASSWORD}`,
      "-rpcbind=127.0.0.1",
      "-rpcallowip=127.0.0.1",
      `-rpcport=${port}`,
      "-listen=0",
      "-dnsseed=0",
      "-fallbackfee=0.0002",
    ],
    { stdio: "ignore" },
  );
  const rpc = makeRpc(port);
  try {
    await waitForRpc(rpc);
  } catch (error) {
    child.kill("SIGKILL");
    throw error;
  }
  return {
    port,
    datadir,
    rpc,
    stop: () => stopRegtest(child, rpc),
  };
}

function makeRpc(port: number) {
  const auth = Buffer.from(`${RPC_USER}:${RPC_PASSWORD}`).toString("base64");
  return async function rpc(method: string, params: unknown[], wallet?: string): Promise<unknown> {
    const url = wallet
      ? `http://127.0.0.1:${port}/wallet/${encodeURIComponent(wallet)}`
      : `http://127.0.0.1:${port}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({ jsonrpc: "1.0", id: "koinon", method, params }),
    });
    const body = (await response.json()) as {
      result: unknown;
      error: { code: number; message: string } | null;
    };
    if (body.error) {
      const error = new Error(`${method}: ${body.error.code} ${body.error.message}`);
      (error as Error & { rpcCode: number }).rpcCode = body.error.code;
      throw error;
    }
    return body.result;
  };
}

async function waitForRpc(rpc: Regtest["rpc"]): Promise<void> {
  const started = Date.now();
  let last = "bitcoind did not start";
  while (Date.now() - started < 20_000) {
    try {
      await rpc("getblockchaininfo", []);
      return;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(last);
}

async function stopRegtest(child: ChildProcess, rpc: Regtest["rpc"]): Promise<void> {
  try {
    await rpc("stop", []);
  } catch {
    child.kill("SIGTERM");
  }
  await new Promise<void>((resolve) => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }
    child.once("exit", () => resolve());
    setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 5_000);
  });
}
