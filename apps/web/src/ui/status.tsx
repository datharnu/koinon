import type { Role } from "@koinon/core";
import type { ReactNode } from "react";

export type UiState = "PENDING" | "ALLOW" | "REFUSE" | "UNKNOWN";

const stateColor: Record<UiState, string> = {
  PENDING: "var(--color-pending)",
  ALLOW: "var(--color-allow)",
  REFUSE: "var(--color-refuse)",
  UNKNOWN: "var(--color-unknown)",
};

/** A state is a word plus a shape, never colour alone. */
export function StatePill({ state, children }: { state: UiState; children: ReactNode }) {
  const color = stateColor[state];
  return (
    <span
      className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium"
      style={{ color, background: `color-mix(in srgb, ${color} 13%, transparent)` }}
    >
      <StateGlyph state={state} />
      {children}
    </span>
  );
}

export function StateGlyph({ state }: { state: UiState }) {
  if (state === "ALLOW") {
    return (
      <svg aria-hidden viewBox="0 0 12 12" className="size-3">
        <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (state === "REFUSE") {
    return (
      <svg aria-hidden viewBox="0 0 12 12" className="size-3">
        <path d="m3 3 6 6m0-6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (state === "PENDING") {
    return <span aria-hidden className="pulse-dot size-1.5 rounded-full bg-current" />;
  }
  return (
    <svg aria-hidden viewBox="0 0 12 12" className="size-3">
      <path d="M4.6 4.4a1.5 1.5 0 1 1 2 1.4c-.4.2-.6.5-.6.9v.3M6 9h.01" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Code({ children, tone = "refuse" }: { children: ReactNode; tone?: "refuse" | "muted" }) {
  return (
    <code
      className={`rounded-md px-1.5 py-0.5 font-mono text-[12px] ${
        tone === "refuse" ? "bg-[color-mix(in_srgb,var(--color-refuse)_12%,transparent)] text-refuse" : "bg-raise text-text-2"
      }`}
    >
      {children}
    </code>
  );
}

export const roleColor: Record<Role, string> = {
  O1: "var(--color-o1)",
  O2: "var(--color-o2)",
  O3: "var(--color-o3)",
  K: "var(--color-k)",
};

export function RoleDot({ role, className = "size-2" }: { role: Role; className?: string }) {
  return <span aria-hidden className={`inline-block shrink-0 rounded-full ${className}`} style={{ background: roleColor[role] }} />;
}

export function RoleChip({ role, label }: { role: Role; label: string }) {
  const color = roleColor[role];
  return (
    <span
      className="inline-flex h-6 max-w-full items-center gap-1.5 truncate rounded-full px-2.5 text-[12px] font-medium"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <RoleDot role={role} className="size-1.5" />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function RegtestBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex h-5 items-center gap-1 rounded-full bg-raise px-2 font-mono text-[10.5px] uppercase tracking-wider text-text-3 hairline">
      <span aria-hidden className="size-1.5 rounded-full bg-pending" />
      {label}
    </span>
  );
}
