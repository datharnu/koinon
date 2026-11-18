import { xof, sats } from "../lib/format";
import type { FundView } from "../lib/http";
import { usePrefs } from "../lib/prefs";
import { Chip } from "../ui/avatar";
import { ErrorState, Skeleton } from "../ui/states";

/** Balance in francs first; sats underneath because that is what the chain holds. */
export function BalanceBlock({ fund, pending, error, retry }: { fund?: FundView; pending: boolean; error: unknown; retry: () => void }) {
  const { t, lang } = usePrefs();
  if (pending) {
    return (
      <div className="mt-2 flex flex-col gap-2">
        <Skeleton className="h-11 w-52 rounded-xl bg-surface/60" />
        <Skeleton className="h-4 w-32 rounded-md bg-surface/60" />
      </div>
    );
  }
  if (error || !fund) {
    return (
      <div className="mt-3">
        <ErrorState error={error} onRetry={retry} />
      </div>
    );
  }
  return (
    <div className="mt-1">
      <p className="tabular break-words text-[44px] font-bold leading-[1.05] tracking-[-0.035em]">
        {fund.balance_xof ? xof(fund.balance_xof, lang) : `${sats(fund.balance_sats, lang)} sats`}
      </p>
      <p className="tabular mt-1.5 flex flex-wrap items-center gap-x-2 text-[13.5px] text-ink-2">
        <span>{sats(fund.balance_sats, lang)} sats</span>
        {fund.rate.stale ? (
          <Chip tone="warn" className="h-5 text-[11px]">
            {t("taux ancien", "stale rate")}
          </Chip>
        ) : null}
      </p>
    </div>
  );
}
