import { startLocalRelay } from "./local-relay.js";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 8080);
const relay = await startLocalRelay({ host, port });
console.log(`relay listening ${host}:${new URL(relay.url).port}`);
console.log("no publisher auth");
