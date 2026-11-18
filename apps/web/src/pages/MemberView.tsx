import { useEffect } from "react";
import { Link } from "wouter";
import { ActivityList } from "../demo/Activity";
import { BalanceBlock } from "../demo/Balance";
import { SectionTitle } from "../demo/ui";
import { errorCode } from "../lib/errors";
import { useMedia } from "../lib/media";
import { usePrefs } from "../lib/prefs";
import { useFund } from "../lib/queries";
import { fingerprintStatus } from "../proof/load";
import { roleLabel } from "../proof/names";
import { MemberChecks } from "../proof/MemberChecks";
import { Chip } from "../ui/avatar";
import { ButtonLink } from "../ui/button";
import { IconEye, IconInfo, Logo } from "../ui/icons";
import { PhoneFrame } from "../ui/phone";
import { EmptyState } from "../ui/states";
import { SiteNav } from "../ui/site";
import { LangToggle, ThemeToggle } from "../ui/toggles";

/** What a member sees from the group chat link: no key, no action, the record checked on this phone. */
export default function MemberView({ fundId }: { fundId: string }) {
  const { t } = usePrefs();
  const framed = useMedia("(min-width: 640px)");
  const body = <MemberApp fundId={fundId} />;
  if (!framed) {
    return (
      <div className="relative flex h-dvh flex-col bg-surface">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4 pt-[env(safe-area-inset-top)]">
          <Link href="/" aria-label={t("Accueil Koinon", "Koinon home")} className="shrink-0">
            <Logo size={26} withName />
          </Link>
          <div className="flex-1" />
          <LangToggle />
          <ThemeToggle />
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{body}</div>
      </div>
    );
  }
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
  const { t, lang } = usePrefs();
  const fund = useFund(fundId);
  const matched = fund.data ? fingerprintStatus(fund.data, window.location.hash.replace(/^#/, "")) === "match" : false;

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
          <span className="max-sm:hidden">
            <Logo size={34} />
          </span>
          <Chip tone="neutral" className="bg-surface/70">
            <IconEye size={13} />
            {t("Lecture seule", "Read only")}
          </Chip>
          <div className="min-w-0 flex-1" />
          <Chip tone="neutral" className="shrink-0 bg-surface/70">regtest</Chip>
        </div>
        <p className="mt-6 break-words text-[13px] font-semibold text-brand-ink">{fund.data?.name ?? "…"}</p>
        <BalanceBlock fund={fund.data} pending={fund.isPending} error={fund.isError && !fund.data ? fund.error : null} retry={() => void fund.refetch()} />
        {fund.data && matched ? (
          <p className="mt-4 break-words text-[13px] leading-snug text-ink-2">
            {t(
              `Toute dépense exige 2 signatures sur 3 : ${fund.data.officers.map((officer) => roleLabel(officer.role, officer.label, lang)).join(", ")}. Bitcoin l'exige, pas ce site.`,
              `Every spend needs 2 of 3 signatures: ${fund.data.officers.map((officer) => roleLabel(officer.role, officer.label, lang)).join(", ")}. Bitcoin enforces it, not this site.`,
            )}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-5 px-4 pt-5">
        {fund.data ? <MemberChecks fund={fund.data} /> : null}
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
