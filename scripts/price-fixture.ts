import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function startPriceFixture(options?: {
  host?: string;
  port?: number;
  eur?: string;
}): Promise<{ url: string; close: () => Promise<void> }> {
  const host = options?.host ?? "127.0.0.1";
  const eur = options?.eur ?? process.env.FIXTURE_EUR ?? "60000";
  if (!/^[0-9]+(?:\.[0-9]+)?$/.test(eur)) {
    throw new Error("FIXTURE_EUR must be a decimal");
  }
  const server = createServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ EUR: eur }));
  });
  return new Promise((resolve) => {
    server.listen(options?.port ?? 0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("price fixture did not bind");
      const advertised = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
      resolve({
        url: `http://${advertised}:${address.port}/`,
        close: () =>
          new Promise((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const eur = process.env.FIXTURE_EUR ?? "60000";
  const fixture = await startPriceFixture({
    host: process.env.HOST ?? "127.0.0.1",
    port: Number(process.env.PORT ?? 8090),
    eur,
  });
  console.log(`price fixture ${eur} EUR at ${fixture.url}, not a market price`);
}
