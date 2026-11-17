import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ACCOUNT_PATH, type Role } from "@koinon/core";
import { line, type Lang } from "./text.js";

export interface OfficerPublic {
  label: string;
  xpub: string;
  nostrPub: string;
}

export interface FundConfig {
  v: 1;
  fundId: string;
  name: string;
  coordinatorUrl: string;
  relayUrl: string;
  csvBlocks: number;
  feeCapSats: string;
  officers: Record<"O1" | "O2" | "O3", OfficerPublic>;
  assembly: OfficerPublic;
}

export function homeDir(): string {
  return process.env.KOINON_HOME ?? ".koinon";
}

export function readConfig(lang: Lang): FundConfig {
  const file = path.join(homeDir(), "config.json");
  try {
    return JSON.parse(readFileSync(file, "utf8")) as FundConfig;
  } catch {
    throw new Error(line(lang, "Aucun fonds sur cette machine. Lancez init-fund.", "No fund on this machine. Run init-fund."));
  }
}

export function writeConfig(config: FundConfig): void {
  const root = homeDir();
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, "config.json"), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

export function keyPath(role: Role): string {
  return path.join(homeDir(), "keys", `${role}.json`);
}

export function accountPath(): typeof ACCOUNT_PATH {
  return ACCOUNT_PATH;
}
