import { createContext, useContext, type ReactNode } from "react";
import { useT } from "../lib/prefs";
import { IconChevronLeft, IconChevronRight } from "../ui/icons";

export type Route =
  | { name: "home" }
  | { name: "requests" }
  | { name: "settings" }
  | { name: "spend" }
  | { name: "request"; id: string }
  | { name: "members" }
  | { name: "recovery" }
  | { name: "activity" };

export type Tab = "home" | "requests" | "settings";

interface Nav {
  push: (route: Route) => void;
  back: () => void;
  tab: (tab: Tab) => void;
  /** Opens a sheet over this phone only. */
  sheet: (node: ReactNode | null) => void;
}

export const NavContext = createContext<Nav | null>(null);

export function useNav(): Nav {
  const value = useContext(NavContext);
  if (!value) throw new Error("NavContext missing");
  return value;
}

/** Title row for a pushed screen. */
export function ScreenHeader({ title, onBack, right, tone = "plain" }: { title: string; onBack?: () => void; right?: ReactNode; tone?: "plain" | "brand" }) {
  const t = useT();
  return (
    <header className={`flex shrink-0 items-center gap-2 px-3 pb-3 pt-[max(1rem,var(--demo-chrome))] ${tone === "brand" ? "bg-brand-soft" : ""}`}>
      {onBack ? (
        <button type="button" onClick={onBack} aria-label={t("Retour", "Back")} className="press grid size-10 place-items-center rounded-full text-ink hover:bg-card">
          <IconChevronLeft size={22} />
        </button>
      ) : (
        <span className="w-2" />
      )}
      <h2 className="min-w-0 flex-1 truncate text-[18px] font-bold">{title}</h2>
      {right}
    </header>
  );
}

/** Big title for tab roots, like a native app. */
export function LargeTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-[max(1.5rem,var(--demo-chrome))]">
      <h2 className="text-[26px] font-bold">{children}</h2>
      {right}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-1 pb-2 pt-1">
      <h3 className="text-[13px] font-semibold text-ink-2">{children}</h3>
      {action}
    </div>
  );
}

export function Group({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded-[22px] bg-surface ring-1 ring-line ${className}`}>{children}</div>;
}

/** A list row: icon, title and subtitle, then a value or a chevron. */
export function Row({
  icon,
  title,
  subtitle,
  right,
  onClick,
  chevron,
  danger,
  testId,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  danger?: boolean;
  testId?: string;
}) {
  const body = (
    <>
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className={`truncate text-[15px] font-semibold ${danger ? "text-bad" : ""}`} title={typeof title === "string" ? title : undefined}>
          {title}
        </span>
        {subtitle ? <span className="truncate text-[12.5px] text-ink-2">{subtitle}</span> : null}
      </span>
      {right ? <span className="flex shrink-0 items-center gap-1 text-right">{right}</span> : null}
      {chevron ? <IconChevronRight size={18} className="shrink-0 text-ink-3" /> : null}
    </>
  );
  const className = "flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 [&+&]:border-t [&+&]:border-line";
  if (onClick) {
    return (
      <button type="button" data-testid={testId} onClick={onClick} className={`${className} press transition-colors hover:bg-card active:scale-[0.99]`}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

export function IconBubble({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" | "good" | "bad" | "warn" }) {
  const tones = {
    neutral: "bg-card text-ink",
    brand: "bg-brand-soft text-brand",
    good: "bg-good-soft text-good",
    bad: "bg-bad-soft text-bad",
    warn: "bg-warn-soft text-warn",
  };
  return <span className={`grid size-10 place-items-center rounded-full ${tones[tone]}`}>{children}</span>;
}

/** Action area pinned to the bottom of a screen. */
export function StickyFooter({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="shrink-0 border-t border-line bg-surface px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
      {note ? <div className="mb-3">{note}</div> : null}
      {children}
    </div>
  );
}

export function Note({ icon, children, tone = "neutral" }: { icon?: ReactNode; children: ReactNode; tone?: "neutral" | "bad" | "good" | "warn" }) {
  const tones = { neutral: "bg-card text-ink-2", bad: "bg-bad-soft text-bad", good: "bg-good-soft text-good", warn: "bg-warn-soft text-warn" };
  return (
    <div className={`flex items-start gap-2.5 rounded-2xl px-3.5 py-3 text-[13px] leading-snug ${tones[tone]}`}>
      {icon ? <span className="mt-px shrink-0">{icon}</span> : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
