import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { errorCode } from "../lib/flows";
import { useT } from "../lib/prefs";
import { Button, Spinner } from "./button";
import { Code } from "./status";

/** "Nothing yet" is a real answer, not an error. */
export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-[var(--radius-card)] p-4 hairline dotgrid">
      <p className="text-[15px] font-medium text-text">{title}</p>
      {body ? <p className="text-[13.5px] leading-relaxed text-text-2">{body}</p> : null}
      {action}
    </div>
  );
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useT();
  return (
    <div role="alert" className="flex flex-col items-start gap-2 rounded-[var(--radius-card)] bg-[color-mix(in_srgb,var(--color-refuse)_7%,transparent)] p-4">
      <Code>{errorCode(error)}</Code>
      <p className="text-[13.5px] text-text-2">
        {t("Le serveur n'a pas répondu comme prévu. La dernière vue confirmée reste valable.", "The server did not answer as expected. The last confirmed view still stands.")}
      </p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t("Réessayer", "Retry")}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Pending, error, then children. While refetching, the previous data stays on screen,
 * marked as the previous one by the caller through `isFetching`.
 */
export function QueryView<T>({ query, children, loading }: { query: UseQueryResult<T>; children: (data: T) => ReactNode; loading?: ReactNode }) {
  const t = useT();
  if (query.isPending) {
    return (
      <div className="py-6 text-sm text-text-3">{loading ?? <Spinner label={t("Chargement…", "Loading…")} />}</div>
    );
  }
  if (query.isError && query.data === undefined) return <ErrorNote error={query.error} onRetry={() => void query.refetch()} />;
  return <>{children(query.data as T)}</>;
}
