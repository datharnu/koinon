/**
 * Regtest-only coin source for the browser demo. It exists only when KOINON_DEMO=1.
 * It pays Koinon member addresses and mines blocks. It never signs for the fund.
 */
export interface DemoWallet {
  pay(address: string, sats: bigint): Promise<string>;
  mine(blocks: number): Promise<number>;
}

export function demoWallet(args: { url: string; user: string; password: string; wallet: string }): DemoWallet {
  const auth = Buffer.from(`${args.user}:${args.password}`).toString("base64");
  const walletUrl = `${args.url}/wallet/${encodeURIComponent(args.wallet)}`;
  let ready: Promise<void> | null = null;

  async function call(url: string, method: string, params: unknown[]): Promise<unknown> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Basic ${auth}` },
      body: JSON.stringify({ jsonrpc: "1.0", id: "koinon-demo", method, params }),
    });
    const body = (await response.json()) as { result: unknown; error: { code: number; message: string } | null };
    if (body.error) throw new Error(`${method}: ${body.error.code} ${body.error.message}`);
    return body.result;
  }

  async function prepare(): Promise<void> {
    try {
      await call(args.url, "createwallet", [args.wallet]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("already exists")) {
        try {
          await call(args.url, "loadwallet", [args.wallet]);
        } catch (loadError) {
          const loadMessage = loadError instanceof Error ? loadError.message : "";
          if (!loadMessage.includes("already loaded")) throw loadError;
        }
      }
    }
    const balance = Number(await call(walletUrl, "getbalance", []));
    if (balance < 5) {
      const address = String(await call(walletUrl, "getnewaddress", []));
      await call(walletUrl, "generatetoaddress", [101, address]);
    }
  }

  function ensure(): Promise<void> {
    ready ??= prepare().catch((error) => {
      ready = null;
      throw error;
    });
    return ready;
  }

  return {
    async pay(address, sats) {
      await ensure();
      const txid = String(await call(walletUrl, "sendtoaddress", [address, btcText(sats)]));
      const miner = String(await call(walletUrl, "getnewaddress", []));
      await call(walletUrl, "generatetoaddress", [1, miner]);
      return txid;
    },
    async mine(blocks) {
      await ensure();
      const miner = String(await call(walletUrl, "getnewaddress", []));
      await call(walletUrl, "generatetoaddress", [blocks, miner]);
      return Number(await call(args.url, "getblockcount", []));
    },
  };
}

function btcText(sats: bigint): string {
  const whole = sats / 100_000_000n;
  const frac = (sats % 100_000_000n).toString().padStart(8, "0");
  return `${whole.toString()}.${frac}`;
}
