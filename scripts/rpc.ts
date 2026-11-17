export async function rpc(method: string, params: unknown[], wallet = false): Promise<unknown> {
  const base = process.env.BITCOIN_RPC_URL ?? "http://127.0.0.1:18445";
  const user = process.env.BITCOIN_RPC_USER ?? "koinon";
  const password = process.env.BITCOIN_RPC_PASSWORD ?? "koinon";
  const name = process.env.BITCOIN_RPC_WALLET ?? "bootstrap";
  const url = wallet ? `${base}/wallet/${encodeURIComponent(name)}` : base;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`,
    },
    body: JSON.stringify({ jsonrpc: "1.0", id: "koinon", method, params }),
  });
  const body = (await response.json()) as { result: unknown; error: { message: string } | null };
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}
