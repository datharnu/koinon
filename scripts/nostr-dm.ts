import { proveNostr } from "../packages/nostr/src/scenario.ts";

const result = await proveNostr();
console.log(result.lines.join("\n"));
if (!result.ok) process.exitCode = 1;
