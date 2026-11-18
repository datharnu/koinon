import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { errorCode } from "../lib/errors";
import { useT } from "../lib/prefs";
import { Button } from "./button";
import { IconAlert } from "./icons";

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[24px] bg-card px-6 py-8 text-center">
      <span className="mb-1 grid size-14 place-items-center rounded-full bg-surface text-ink-3 shadow-[0_2px_8px_-4px_rgb(0_0_0/0.15)]">{icon}</span>
      <p className="text-[15.5px] font-bold">{title}</p>
      {body ? <p className="max-w-[260px] text-[13.5px] leading-snug text-ink-2">{body}</p> : null}
      {action ? <div className="mt-3 w-full">{action}</div> : null}
    </div>
  );
}

/** Plain words first; the code is small, for whoever debugs. */
export function ErrorState({ error, onRetry, title }: { error: unknown; onRetry?: () => void; title?: string }) {
  const t = useT();
  const code = errorCode(error);
  const offline = Boolean(error && typeof error === "object" && "status" in error && (error as { status: unknown }).status === 0);
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-[24px] bg-card px-6 py-7 text-center">
      <span className="mb-1 grid size-12 place-items-center rounded-full bg-bad-soft text-bad">
        <IconAlert size={20} />
      </span>
      <p className="text-[15px] font-bold">{title ?? (offline ? t("Connexion impossible", "Can't connect") : t("Quelque chose a échoué", "Something went wrong"))}</p>
      <p className="max-w-[260px] text-[13px] leading-snug text-ink-2">
        {offline ? t("Le serveur de la caisse ne répond pas. Vos fonds ne bougent pas.", "The fund server is not answering. Your funds don't move.") : t("Rien n'a été modifié.", "Nothing was changed.")}
      </p>
      <span className="font-mono text-[11px] text-ink-3">{code}</span>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2">
          {t("Réessayer", "Try again")}
        </Button>
      ) : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-2xl ${className}`} />;
}

export function QueryView<T>({ query, children, loading }: { query: UseQueryResult<T>; children: (data: T) => ReactNode; loading?: ReactNode }) {
  if (query.isPending) return <>{loading ?? <Skeleton className="h-24" />}</>;
  if (query.isError && query.data === undefined) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return <>{children(query.data as T)}</>;
}
