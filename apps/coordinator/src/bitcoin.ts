export interface BitcoinClient {
  getBlockCount(): Promise<number>;
  getBlockHash(height: number): Promise<string>;
  getBlockHex(hash: string): Promise<string>;
  sendRawTransaction(hex: string): Promise<string>;
  /** Raw transactions in the mempool, hex. Used so a broadcast spend can show as 0 confirmations. */
  getMempoolHex(): Promise<string[]>;
}

export function bitcoinRpc(args: { url: string; user: string; password: string }): BitcoinClient {
  const auth = Buffer.from(`${args.user}:${args.password}`).toString("base64");
  async function call(method: string, params: unknown[]): Promise<unknown> {
    const response = await fetch(args.url, {
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
      throw new Error(`${method}: ${body.error.code} ${body.error.message}`);
    }
    return body.result;
  }
  return {
    async getBlockCount() {
      return (await call("getblockcount", [])) as number;
    },
    async getBlockHash(height) {
      return (await call("getblockhash", [height])) as string;
    },
    async getBlockHex(hash) {
      return (await call("getblock", [hash, 0])) as string;
    },
    async sendRawTransaction(hex) {
      return (await call("sendrawtransaction", [hex])) as string;
    },
    async getMempoolHex() {
      const ids = (await call("getrawmempool", [])) as string[];
      const hexes: string[] = [];
      for (const id of ids) {
        hexes.push((await call("getrawtransaction", [id, 0])) as string);
      }
      return hexes;
    },
  };
}
