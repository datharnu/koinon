import type { Role } from "@koinon/core";
import { roleColor } from "./status";

/** The motif: a keyhole. Two of them make the cashbox. */
export function Keyhole({ filled, color, size = 22, turned }: { filled: boolean; color: string; size?: number; turned?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 22 22" width={size} height={size} className={turned ? "turn" : undefined}>
      <rect x="1" y="1" width="20" height="20" rx="6" fill={filled ? `color-mix(in srgb, ${color} 18%, transparent)` : "none"} stroke={filled ? color : "var(--color-line-strong)"} strokeWidth="1.4" strokeDasharray={filled ? undefined : "2.5 2.5"} />
      <circle cx="11" cy="9" r="2.7" fill={filled ? color : "var(--color-text-3)"} opacity={filled ? 1 : 0.5} />
      <path d="M9.8 11h2.4l.7 4.6H9.1z" fill={filled ? color : "var(--color-text-3)"} opacity={filled ? 1 : 0.5} />
    </svg>
  );
}

/** Signature progress: two keyholes, filled by whoever turned them, in their colour. */
export function Locks({ signers, size = 22 }: { signers: Role[]; size?: number }) {
  const first = signers[0];
  const second = signers[1];
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${signers.length}/2`}>
      <Keyhole filled={Boolean(first)} color={first ? roleColor[first] : ""} size={size} turned={Boolean(first)} />
      <Keyhole filled={Boolean(second)} color={second ? roleColor[second] : ""} size={size} turned={Boolean(second)} />
    </span>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg aria-hidden viewBox="0 0 32 32" className="size-7">
        <rect x="2" y="5" width="28" height="22" rx="7" fill="var(--color-panel)" stroke="var(--color-o1)" strokeWidth="1.8" />
        <circle cx="11.5" cy="14.5" r="2.6" fill="var(--color-o1)" />
        <path d="M10.4 16.5h2.2l.7 4.5h-3.6z" fill="var(--color-o1)" />
        <circle cx="20.5" cy="14.5" r="2.6" fill="var(--color-brand)" />
        <path d="M19.4 16.5h2.2l.7 4.5h-3.6z" fill="var(--color-brand)" />
      </svg>
      <span className="text-[19px] font-semibold tracking-[-0.04em]">Koinon</span>
    </span>
  );
}

/** Section label: index · NAME · a rule that ends in two keyhole dots. */
export function SectionLabel({ index, name }: { index: string; name: string }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[12px] uppercase tracking-[0.14em] text-text-3">
      <span className="text-text-2">{index}</span>
      <span aria-hidden>·</span>
      <span>{name}</span>
      <span aria-hidden className="h-px w-10 bg-line-strong sm:w-16" />
      <span aria-hidden className="flex gap-1">
        <span className="size-1.5 rounded-full bg-o1" />
        <span className="size-1.5 rounded-full bg-brand" />
      </span>
    </div>
  );
}
