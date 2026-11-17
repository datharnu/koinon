import type { Role } from "@koinon/core";
import type { ReactNode } from "react";
import { RoleDot } from "./status";

/**
 * On a laptop the app sits in a device frame, because that is what the officer holds.
 * On a phone the frame disappears and the app is the screen.
 */
export function PhoneFrame({
  children,
  owner,
  ownerLabel,
  framed = true,
  className = "",
}: {
  children: ReactNode;
  owner?: Role;
  ownerLabel?: string;
  framed?: boolean;
  className?: string;
}) {
  if (!framed) return <div className={`flex min-h-0 flex-1 flex-col bg-ink ${className}`}>{children}</div>;
  return (
    <figure className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="relative w-[360px] rounded-[48px] bg-[color-mix(in_srgb,var(--color-text)_9%,var(--color-ink))] p-[10px] shadow-[0_0_0_1px_var(--color-line-strong),0_30px_80px_-30px_rgb(0_0_0/0.55)]">
        <div className="relative flex h-[740px] flex-col overflow-hidden rounded-[38px] bg-ink">
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-2.5 z-20 h-[26px] w-[96px] -translate-x-1/2 rounded-full bg-black" />
          {children}
        </div>
      </div>
      {owner && ownerLabel ? (
        <figcaption className="flex items-center gap-2 text-[13px] text-text-3">
          <RoleDot role={owner} />
          {ownerLabel}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function StatusBar({ right }: { right?: ReactNode }) {
  const time = new Date().toLocaleTimeString("fr-SN", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="flex h-11 shrink-0 items-center justify-between px-7 pt-1 font-mono text-[12px] text-text-2">
      <span className="tabular">{time}</span>
      <span className="flex items-center gap-1.5">{right}</span>
    </div>
  );
}
