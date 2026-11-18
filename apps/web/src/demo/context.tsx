import type { Role } from "@koinon/core";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { FundConfig, Secret } from "../lib/vault";

interface Demo {
  config: FundConfig;
  /** A second phone may hold only one officer. Callers that need a key must check. */
  secrets: Partial<Record<Role, Secret>>;
  /** Bumps when a phone acts, so the other phone reads the relay sooner. */
  pulse: number;
  touch: () => void;
}

export function secretFor(secrets: Partial<Record<Role, Secret>>, role: Role): Secret {
  const secret = secrets[role];
  if (!secret) throw new Error("NO_KEY");
  return secret;
}

const DemoContext = createContext<Demo | null>(null);

export function DemoProvider({ config, secrets, children }: { config: FundConfig; secrets: Partial<Record<Role, Secret>>; children: ReactNode }) {
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
