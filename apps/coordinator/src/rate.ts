import { PEG_TEXT, xofPerBtcFromEur } from "@koinon/core";

export interface RateSnapshot {
  network: "regtest";
  regtest_sats_have_no_value: true;
  btc_eur: string | null;
  btc_xof: string | null;
  fetched_at: string | null;
  age_seconds: number | null;
  stale: boolean;
  peg: typeof PEG_TEXT;
}

interface CachedRate {
  eur: string;
  xof: string;
  fetchedAt: number;
}

const FRESH_MS = 60_000;

export class RateCache {
  private cached: CachedRate | null = null;

  constructor(
    private readonly fetchEur: () => Promise<string>,
    private readonly now: () => number = Date.now,
  ) {}

  async current(): Promise<RateSnapshot> {
    const now = this.now();
    if (this.cached && now - this.cached.fetchedAt < FRESH_MS) {
      return toSnapshot(this.cached, false, now);
    }
    try {
      const eur = await this.fetchEur();
      const xof = xofPerBtcFromEur(eur);
      this.cached = { eur, xof, fetchedAt: now };
      return toSnapshot(this.cached, false, now);
    } catch {
      if (this.cached) return toSnapshot(this.cached, true, now);
      return emptyRate();
    }
  }
}

export async function fetchBtcEur(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) {
    throw new Error(`rate http ${response.status}`);
  }
  const text = await response.text();
  const match = text.match(/"EUR"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/);
  const eur = match?.[1];
  if (!eur) {
    throw new Error("rate response has no EUR price");
  }
  return eur;
}

function toSnapshot(cached: CachedRate, stale: boolean, now: number): RateSnapshot {
  return {
    network: "regtest",
    regtest_sats_have_no_value: true,
    btc_eur: cached.eur,
    btc_xof: cached.xof,
    fetched_at: new Date(cached.fetchedAt).toISOString(),
    age_seconds: Math.max(0, Math.floor((now - cached.fetchedAt) / 1000)),
    stale,
    peg: PEG_TEXT,
  };
}

function emptyRate(): RateSnapshot {
  return {
    network: "regtest",
    regtest_sats_have_no_value: true,
    btc_eur: null,
    btc_xof: null,
    fetched_at: null,
    age_seconds: null,
    stale: true,
    peg: PEG_TEXT,
  };
}
