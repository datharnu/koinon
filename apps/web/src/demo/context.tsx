import type { Role } from "@koinon/core";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { FundConfig, Secret } from "../lib/vault";

interface Demo {
  config: FundConfig;
  secrets: Record<Role, Secret>;
  /** Bumps when a phone acts, so the other phone reads the relay sooner. */
  pulse: number;
  touch: () => void;
}

const DemoContext = createContext<Demo | null>(null);

export function DemoProvider({ config, secrets, children }: { config: FundConfig; secrets: Record<Role, Secret>; children: ReactNode }) {
  const [pulse, setPulse] = useState(0);
  const touch = useCallback(() => setPulse((value) => value + 1), []);
  const value = useMemo(() => ({ config, secrets, pulse, touch }), [config, secrets, pulse, touch]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): Demo {
  const value = useContext(DemoContext);
  if (!value) throw new Error("DemoProvider missing");
  return value;
}
