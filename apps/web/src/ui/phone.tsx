import type { ReactNode } from "react";

/**
 * On a laptop the app sits in a phone-sized card, because that is what an officer holds.
 * On a phone the card disappears and the app is the screen.
 */
export function PhoneFrame({ children, framed = true, caption, className = "" }: { children: ReactNode; framed?: boolean; caption?: ReactNode; className?: string }) {
  if (!framed) return <div className={`relative flex min-h-0 flex-1 flex-col overflow-hidden bg-surface ${className}`}>{children}</div>;
  return (
    <figure className={`flex h-full max-h-[min(760px,100%)] min-h-0 w-[372px] max-w-full flex-col items-center gap-3 ${className}`}>
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[44px] bg-surface shadow-[0_0_0_1px_var(--color-line),0_40px_80px_-32px_rgb(20_14_60/0.35)]">
        {children}
      </div>
      {caption ? <figcaption className="flex shrink-0 items-center gap-2 text-[13.5px] text-ink-2">{caption}</figcaption> : null}
    </figure>
  );
}
