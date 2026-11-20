import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useT } from "../lib/prefs";
import { IconAlert, IconCheck, IconChevronDown, IconInfo, IconX } from "./icons";

export type ToastTone = "good" | "bad" | "info";

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
  /** Raw text a judge may want (a node message, a txid). Hidden behind a tap. */
  detail?: string;
}

const ToastContext = createContext<(toast: Omit<Toast, "id">) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = Date.now() + Math.random();
      // Toasts sit over the top of both phones on the wide stage; more than one hides the amount.
      setToasts([{ ...toast, id }]);
      timers.current.set(id, window.setTimeout(() => dismiss(id), toast.detail ? 9000 : 4500));
    },
    [dismiss],
  );

  const hold = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
  }, []);

  const release = useCallback(
    (id: number) => {
      const timer = timers.current.get(id);
      if (timer) window.clearTimeout(timer);
      timers.current.set(id, window.setTimeout(() => dismiss(id), 2_000));
    },
    [dismiss],
  );

  const value = useMemo(() => push, [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-3">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onClose={() => dismiss(toast.id)} onHold={() => hold(toast.id)} onRelease={() => release(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onClose, onHold, onRelease }: { toast: Toast; onClose: () => void; onHold: () => void; onRelease: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const icon =
    toast.tone === "good" ? (
      <span className="grid size-8 place-items-center rounded-full bg-good text-white">
        <IconCheck size={17} />
      </span>
    ) : toast.tone === "bad" ? (
      <span className="grid size-8 place-items-center rounded-full bg-bad text-white">
        <IconAlert size={16} />
      </span>
    ) : (
      <span className="grid size-8 place-items-center rounded-full bg-card-2 text-ink">
        <IconInfo size={17} />
      </span>
    );
  return (
    <div role="status" onPointerEnter={onHold} onPointerLeave={onRelease} className="toast-in pointer-events-auto w-full max-w-[420px] rounded-[22px] bg-surface p-3 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.35)] ring-1 ring-line">
      <div className="flex items-start gap-3">
        <span className="shrink-0">{icon}</span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[14.5px] font-semibold leading-snug">{toast.title}</p>
          {toast.body ? <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{toast.body}</p> : null}
          {toast.detail ? (
            <button
              type="button"
              onClick={() => {
                onHold();
                setOpen(!open);
              }}
              className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand"
            >
              {open ? t("Masquer", "Hide") : t("Voir le détail", "Show details")}
              <IconChevronDown size={14} className={open ? "rotate-180" : ""} />
            </button>
          ) : null}
          {open && toast.detail ? <p className="mt-2 break-all rounded-xl bg-card p-2.5 font-mono text-[11.5px] leading-relaxed text-ink-2">{toast.detail}</p> : null}
        </div>
        <button type="button" onClick={onClose} aria-label={t("Fermer", "Close")} className="grid size-7 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-card hover:text-ink">
          <IconX size={15} />
        </button>
      </div>
    </div>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
