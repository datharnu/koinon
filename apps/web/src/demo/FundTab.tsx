import { useQuery } from "@tanstack/react-query";
import { endpoints } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import { middle, relative, sats, xof } from "../lib/format";
import { Empty, QueryView } from "../ui/query";
import { useDemo } from "./context";
import { useFund, useLedger, useMembers } from "./hooks";
import type { FundView, LedgerEntry, Member } from "../lib/api";
import { StatePill } from "../ui/status";

export function FundTab() {
  const { config } = useDemo();
  const fund = useFund(config.fundId);
  return (
    <div className="flex flex-col gap-4">
      <QueryView query={fund}>{(data) => <Balance fund={data} refreshing={fund.isFetching && fund.isError} />}</QueryView>
      <Ledger fundId={config.fundId} />
    </div>
  );
}

export function Balance({ fund, refreshing }: { fund: FundView; refreshing?: boolean }) {
  const { t, lang } = usePrefs();
  return (
    <div className={`flex flex-col gap-1 rounded-[var(--radius-card)] bg-panel p-4 hairline transition-opacity ${refreshing ? "opacity-60" : ""}`}>
      <span className="text-[12px] text-text-3">{t("Solde du fonds", "Fund balance")}</span>
      <p className="font-mono text-[30px] leading-tight tabular">{fund.balance_xof === null ? t("taux indisponible", "rate unavailable") : xof(fund.balance_xof, lang)}</p>
      <p className="font-mono text-[12px] text-text-3">
        {sats(fund.balance_sats, lang)} sats · {t("bloc", "block")} {fund.chain_tip}
      </p>
      <p className="mt-2 text-[12px] leading-snug text-text-3">
        {fund.rate.btc_eur
          ? t(`Taux de démo : 1 BTC = ${fund.rate.btc_eur} € (valeur fixe, pas un prix de marché). Sats regtest sans valeur.`, `Demo rate: 1 BTC = €${fund.rate.btc_eur} (fixed value, not a market price). Regtest sats have no value.`)
          : t("Aucun prix disponible : aucune dépense ne peut être créée.", "No price available: no spend can be created.")}
        {fund.rate.stale ? ` ${t("Taux périmé.", "Rate is stale.")}` : ""}
      </p>
    </div>
  );
}

export function Ledger({ fundId }: { fundId: string }) {
  const { t } = usePrefs();
  const ledger = useLedger(fundId);
  const members = useMembers(fundId);
  return (
    <section aria-labelledby="ledger-title" className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h3 id="ledger-title" className="text-[14px] font-semibold tracking-normal">
          {t("Registre", "Ledger")}
        </h3>
        {ledger.isFetching ? <span className="font-mono text-[11px] text-text-3">{t("mise à jour…", "updating…")}</span> : null}
      </div>
      <QueryView query={ledger}>
        {(data) =>
          data.entries.length === 0 ? (
            <Empty title={t("Aucune écriture.", "No entries.")} body={t("Une cotisation apparaît après le prochain bloc miné.", "A due appears after the next mined block.")} />
          ) : (
            <ul className={`flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-panel hairline ${ledger.isError ? "opacity-60" : ""}`}>
              {[...data.entries].sort((a, b) => a.confirmations - b.confirmations).map((entry) => (
                <LedgerRow key={`${entry.kind}-${entry.txid}-${entry.vout ?? "s"}`} entry={entry} members={members.data?.members ?? []} />
              ))}
            </ul>
          )
        }
      </QueryView>
    </section>
  );
}

/** A spend's CFA figure is the one locked on its request, not a re-conversion at today's rate. */
function SpendAmount({ requestId, fallback }: { requestId: string; fallback: string }) {
  const { lang } = usePrefs();
  const request = useQuery({ queryKey: ["request", requestId], queryFn: () => endpoints.request(requestId), staleTime: 60_000 });
  return <>{request.data ? xof(request.data.amount_xof, lang) : fallback}</>;
}

function LedgerRow({ entry, members }: { entry: LedgerEntry; members: Member[] }) {
  const { t, lang } = usePrefs();
  const spend = entry.kind === "spend";
  const who = spend
    ? entry.request_id
      ? t("Dépense 2-sur-3", "2-of-3 spend")
      : t("Sortie hors demande", "Unrequested spend")
    : (members.find((member) => member.index === entry.index)?.pseudonym ?? `#${entry.index ?? "?"}`);
  return (
    <li className="flex items-center gap-3 border-t border-line px-3.5 py-3 first:border-t-0">
      <span
        aria-hidden
        className={`grid size-8 shrink-0 place-items-center rounded-full font-mono text-[13px] ${spend ? "bg-[color-mix(in_srgb,var(--color-o1)_16%,transparent)] text-o1" : "bg-[color-mix(in_srgb,var(--color-allow)_14%,transparent)] text-allow"}`}
      >
        {spend ? "↑" : "↓"}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-medium" title={who}>
          {spend ? who : `${t("Cotisation", "Due")} · ${who}`}
        </span>
        <span className="truncate font-mono text-[11px] text-text-3" title={entry.txid}>
          {middle(entry.txid, 4)} · {relative(entry.seen_at, lang)}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className={`font-mono text-[14px] tabular ${spend ? "text-text" : "text-allow"}`}>
          {spend ? "−" : "+"}
          {spend && entry.request_id ? (
            <SpendAmount requestId={entry.request_id} fallback={`${sats(entry.sats, lang)} sats`} />
          ) : entry.xof_at_receipt ? (
            xof(entry.xof_at_receipt, lang)
          ) : (
            `${sats(entry.sats, lang)} sats`
          )}
        </span>
        {entry.confirmations < 1 ? (
          <StatePill state="PENDING">{t("non confirmé", "unconfirmed")}</StatePill>
        ) : (
          <span className="font-mono text-[11px] text-text-3">
            {entry.confirmations} conf
          </span>
        )}
      </span>
    </li>
  );
}
