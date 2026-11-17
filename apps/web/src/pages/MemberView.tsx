import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ActivityList } from "../demo/Activity";
import { useFund } from "../demo/hooks";
import { BalanceBlock } from "../demo/HomeScreen";
import { SectionTitle } from "../demo/ui";
import { endpoints } from "../lib/api";
import { errorCode } from "../lib/flows";
import { useMedia } from "../lib/media";
import { usePrefs } from "../lib/prefs";
import { Chip } from "../ui/avatar";
import { ButtonLink } from "../ui/button";
import { IconEye, IconInfo, Logo } from "../ui/icons";
import { PhoneFrame } from "../ui/phone";
import { EmptyState } from "../ui/states";
import { SiteNav } from "../ui/site";

/** What a member sees from the group chat link: no key, no action, only the record. */
export default function MemberView({ fundId }: { fundId: string }) {
  const framed = useMedia("(min-width: 640px)");
  const body = <MemberApp fundId={fundId} />;
  if (!framed) return <div className="flex h-dvh flex-col bg-surface">{body}</div>;
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteNav links={false} />
      <main className="flex flex-1 items-center justify-center px-4 pb-10 pt-24">
        <PhoneFrame>{body}</PhoneFrame>
      </main>
    </div>
  );
}

function MemberApp({ fundId }: { fundId: string }) {
  const { t } = usePrefs();
  const fund = useFund(fundId);
  const audit = useQuery({ queryKey: ["audit", fundId], queryFn: () => endpoints.auditVerify(fundId), refetchInterval: 30_000 });

  useEffect(() => {
    document.title = fund.data ? `${fund.data.name} · Koinon` : "Koinon";
  }, [fund.data]);

  if (fund.isError && errorCode(fund.error) === "NOT_FOUND") {
    return (
      <div className="flex flex-1 flex-col justify-center px-5">
        <EmptyState
          icon={<IconInfo size={24} />}
          title={t("Caisse introuvable", "Fund not found")}
          body={t("Ce lien ne correspond à aucune caisse sur ce serveur. Demandez un nouveau lien au bureau.", "This link matches no fund on this server. Ask the officers for a new link.")}
          action={
            <ButtonLink href="/app" variant="secondary" className="w-full">
              {t("Créer une caisse de démo", "Create a demo fund")}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-6">
      <div className="rounded-b-[32px] bg-brand-soft px-5 pb-6 pt-5">
        <div className="flex items-center gap-2">
          <Logo size={34} />
          <div className="flex-1" />
          <Chip tone="neutral" className="bg-surface/70">
            <IconEye size={13} />
            {t("Lecture seule", "Read only")}
          </Chip>
          <Chip tone="neutral" className="bg-surface/70">regtest</Chip>
        </div>
        <p className="mt-6 break-words text-[13px] font-semibold text-brand-ink">{fund.data?.name ?? "…"}</p>
        <BalanceBlock fund={fund.data} pending={fund.isPending} error={fund.isError && !fund.data ? fund.error : null} retry={() => void fund.refetch()} />
        {fund.data ? (
          <p className="mt-4 text-[13px] leading-snug text-ink-2">
            {t(
              `Toute dépense exige 2 signatures sur 3 : ${fund.data.officers.map((officer) => officer.label).join(", ")}. Bitcoin l'exige, pas ce site.`,
              `Every spend needs 2 of 3 signatures: ${fund.data.officers.map((officer) => officer.label).join(", ")}. Bitcoin enforces it, not this site.`,
            )}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-5 px-4 pt-5">
        <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3">
          <span className="text-[14px] font-semibold">{t("Journal d'audit", "Audit log")}</span>
          {audit.data ? (
            audit.data.ok ? (
              <Chip tone="good" dot>{t("Intact", "Intact")}</Chip>
            ) : (
              <Chip tone="bad" dot>{t(`Cassé à #${audit.data.seq ?? "?"}`, `Broken at #${audit.data.seq ?? "?"}`)}</Chip>
            )
          ) : audit.isError ? (
            <Chip tone="neutral">{t("Non vérifié", "Not verified")}</Chip>
          ) : (
            <Chip tone="neutral">{t("Vérification…", "Checking…")}</Chip>
          )}
        </div>
        {fund.data ? (
          <section>
            <SectionTitle>{t("Activité", "Activity")}</SectionTitle>
            <ActivityList fundId={fundId} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
