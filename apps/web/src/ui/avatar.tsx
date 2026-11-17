import type { ReactNode } from "react";
import { initials, type Tone } from "../lib/people";

const toneClass: Record<Tone, string> = {
  amber: "bg-amber-soft text-amber",
  sky: "bg-sky-soft text-sky",
  rose: "bg-rose-soft text-rose",
  stone: "bg-stone-soft text-stone",
  brand: "bg-brand-soft text-brand",
  good: "bg-good-soft text-good",
};

export function Avatar({ name, tone, size = 40, children, ring }: { name?: string; tone: Tone; size?: number; children?: ReactNode; ring?: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-bold ${toneClass[tone]} ${ring ? "ring-[3px] ring-surface" : ""}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {children ?? initials(name ?? "?")}
    </span>
  );
}

export type ChipTone = "brand" | "good" | "bad" | "warn" | "neutral";

const chipClass: Record<ChipTone, string> = {
  brand: "bg-brand-soft text-brand-ink",
  good: "bg-good-soft text-good",
  bad: "bg-bad-soft text-bad",
  warn: "bg-warn-soft text-warn",
  neutral: "bg-card text-ink-2",
};

export function Chip({ tone = "neutral", children, dot, className = "" }: { tone?: ChipTone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold ${chipClass[tone]} ${className}`}>
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
