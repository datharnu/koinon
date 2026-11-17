import type { Role } from "@koinon/core";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { UiState } from "../ui/status";
import type { FundConfig, Secret } from "../lib/vault";

export interface LabEntry {
  id: number;
  at: string;
  actor: Role | "net";
  state: UiState;
  title: string;
  detail?: string;
}

interface Demo {
  config: FundConfig;
  secrets: Record<Role, Secret>;
  entries: LabEntry[];
  log: (entry: Omit<LabEntry, "id" | "at">) => void;
  /** Bumps when a phone acts, so the other phone polls sooner. */
  pulse: number;
  touch: () => void;
}

const DemoContext = createContext<Demo | null>(null);

export function DemoProvider({ config, secrets, children }: { config: FundConfig; secrets: Record<Role, Secret>; children: ReactNode }) {
  const [entries, setEntries] = useState<LabEntry[]>([]);
  const [pulse, setPulse] = useState(0);
  const log = useCallback((entry: Omit<LabEntry, "id" | "at">) => {
    setEntries((list) => [{ ...entry, id: Date.now() + Math.random(), at: new Date().toISOString() }, ...list].slice(0, 60));
  }, []);
  const touch = useCallback(() => setPulse((value) => value + 1), []);
  const value = useMemo(() => ({ config, secrets, entries, log, pulse, touch }), [config, secrets, entries, log, pulse, touch]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): Demo {
  const value = useContext(DemoContext);
  if (!value) throw new Error("DemoProvider missing");
  return value;
}
