import { useEffect, useId, useRef, type ReactNode } from "react";
import { useT } from "../lib/prefs";
import { IconX } from "./icons";

/**
 * Bottom sheet. Inside a phone it covers the phone (`contained`); on the page it covers the viewport,
 * and on wide screens it becomes a centred dialog.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  contained = false,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  contained?: boolean;
  footer?: ReactNode;
}) {
  const t = useT();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const position = contained ? "absolute" : "fixed";
  return (
    <div className={`${position} inset-0 z-40 flex items-end justify-center ${contained ? "" : "sm:items-center sm:p-6"}`}>
      <button type="button" aria-label={t("Fermer", "Close")} onClick={onClose} className="backdrop-in absolute inset-0 cursor-default bg-black/40" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`sheet-in relative flex max-h-[88%] w-full flex-col rounded-t-[28px] bg-surface pb-[max(env(safe-area-inset-bottom),16px)] shadow-[0_-10px_40px_-12px_rgb(0_0_0/0.3)] focus:outline-none ${
          contained ? "" : "max-h-[90dvh] sm:max-w-[460px] sm:rounded-[28px] sm:pb-4"
        }`}
      >
        <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-card-2" />
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-3">
          {title ? (
            <h2 id={titleId} className="text-[18px] font-bold">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button type="button" onClick={onClose} aria-label={t("Fermer", "Close")} className="press grid size-9 place-items-center rounded-full bg-card text-ink-2 hover:text-ink">
            <IconX size={18} />
          </button>
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-2">{children}</div>
        {footer ? <div className="shrink-0 px-5 pt-3">{footer}</div> : null}
      </div>
    </div>
  );
}
