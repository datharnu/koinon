import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function runKoinon(args: string[], env: NodeJS.ProcessEnv = process.env): Promise<{ code: number; out: string }> {
  const tsx = path.join(root, "node_modules/.bin/tsx");
  return new Promise((resolve, reject) => {
    const child = spawn(tsx, [path.join(root, "apps/cli/src/main.ts"), ...args], { cwd: root, env });
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      out += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, out }));
  });
}
