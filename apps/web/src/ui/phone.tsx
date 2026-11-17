import type { ReactNode } from "react";

/**
 * On a laptop the app sits in a phone-sized card, because that is what an officer holds.
 * On a phone the card disappears and the app is the screen.
 */
export function PhoneFrame({ children, framed = true, caption, className = "" }: { children: ReactNode; framed?: boolean; caption?: ReactNode; className?: string }) {
  if (!framed) return <div className={`relative flex min-h-0 flex-1 flex-col overflow-hidden bg-surface ${className}`}>{children}</div>;
  return (
    <figure className={`flex flex-col items-center gap-4 ${className}`}>
      <div className="relative flex h-[760px] max-h-[calc(100dvh-200px)] min-h-[600px] w-[372px] flex-col overflow-hidden rounded-[44px] bg-surface shadow-[0_0_0_1px_var(--color-line),0_40px_80px_-32px_rgb(20_14_60/0.35)]">
        {children}
      </div>
      {caption ? <figcaption className="flex items-center gap-2 text-[13.5px] text-ink-2">{caption}</figcaption> : null}
    </figure>
  );
}
