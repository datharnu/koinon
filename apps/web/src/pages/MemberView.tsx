import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Balance, Ledger } from "../demo/FundTab";
import { useFund } from "../demo/hooks";
import { endpoints } from "../lib/api";
import { errorCode } from "../lib/flows";
import { usePrefs } from "../lib/prefs";
import { ButtonLink } from "../ui/button";
import { TopBar } from "../ui/chrome";
import { QueryView } from "../ui/query";
import { Code, RegtestBadge, StatePill } from "../ui/status";

/** What a member sees from the group chat link: no key, no action, only the record. */
export default function MemberView({ fundId }: { fundId: string }) {
  const { t } = usePrefs();
  const fund = useFund(fundId);
  const audit = useQuery({ queryKey: ["audit", fundId], queryFn: () => endpoints.auditVerify(fundId), refetchInterval: 30_000 });

  useEffect(() => {
    document.title = fund.data ? `${fund.data.name} · Koinon` : "Koinon";
  }, [fund.data]);

  const notFound = fund.isError && errorCode(fund.error) === "NOT_FOUND";

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-4 px-4 py-8">
        {notFound ? (
          <div className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] p-5 hairline dotgrid">
            <Code tone="muted">NOT_FOUND</Code>
            <p className="text-[15px]">{t("Ce fonds n'existe pas sur ce coordinateur.", "This fund does not exist on this coordinator.")}</p>
            <ButtonLink href="/app" size="sm" variant="secondary" arrow>
              {t("Créer un fonds de démo", "Create a demo fund")}
            </ButtonLink>
          </div>
        ) : (
          <>
            <QueryView query={fund}>
              {(data) => (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 px-1">
                    <RegtestBadge label={t("regtest · sats sans valeur", "regtest · sats have no value")} />
                    <h1 className="break-words text-[24px] font-semibold leading-tight tracking-[-0.03em]">{data.name}</h1>
                    <p className="text-[13.5px] leading-snug text-text-2">
                      {t(
                        `Toute dépense exige 2 des 3 clés du bureau (${data.officers.map((officer) => officer.label).join(", ")}). C'est Bitcoin qui l'exige, pas ce site.`,
                        `Every spend needs 2 of the 3 officer keys (${data.officers.map((officer) => officer.label).join(", ")}). Bitcoin enforces it, not this site.`,
                      )}
                    </p>
                  </div>
                  <Balance fund={data} refreshing={fund.isError} />
                </div>
              )}
            </QueryView>
            <div className="flex items-center gap-2 px-1 text-[13px] text-text-2">
              {audit.data ? (
                audit.data.ok ? (
                  <StatePill state="ALLOW">{t("journal d'audit intact", "audit log intact")}</StatePill>
                ) : (
                  <StatePill state="REFUSE">{t(`journal cassé à #${audit.data.seq ?? "?"}`, `log broken at #${audit.data.seq ?? "?"}`)}</StatePill>
                )
              ) : audit.isError ? (
                <StatePill state="UNKNOWN">{t("audit non vérifié", "audit not verified")}</StatePill>
              ) : (
                <StatePill state="PENDING">{t("vérification du journal…", "checking the log…")}</StatePill>
              )}
            </div>
            {fund.data ? <Ledger fundId={fundId} /> : null}
          </>
        )}
      </main>
    </div>
  );
}
