import type { FundView } from "../lib/api";
import { xof, sats } from "../lib/format";
import type { OfficerRole } from "../lib/flows";
import { PEOPLE, roleTitle } from "../lib/people";
import { usePrefs } from "../lib/prefs";
import { Avatar, Chip } from "../ui/avatar";
import { Button } from "../ui/button";
import { IconChevronRight, IconCopy, IconLink, IconSend, IconUserPlus } from "../ui/icons";
import { Sheet } from "../ui/sheet";
import { ErrorState, Skeleton } from "../ui/states";
import { useToast } from "../ui/toast";
import { ActivityList } from "./Activity";
import { useDemo } from "./context";
import { useFund, useOfficerRequests } from "./hooks";
import { SectionTitle, useNav } from "./ui";

export function HomeScreen({ role }: { role: OfficerRole }) {
  const { t } = usePrefs();
  const demo = useDemo();
  const nav = useNav();
  const fund = useFund(demo.config.fundId);
  const { toSign } = useOfficerRequests(role);
  const me = PEOPLE[role];
  const next = toSign[0];

  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-4">
      <div className="rounded-b-[32px] bg-brand-soft px-5 pb-6 pt-5">
        <div className="flex items-center gap-3">
          <Avatar name={me.name} tone={me.tone} size={42} ring />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold">{t(`Bonjour, ${me.first}`, `Hi, ${me.first}`)}</p>
            <p className="truncate text-[12.5px] text-ink-2">{roleTitle(role, t)}</p>
          </div>
          <Chip tone="neutral" className="bg-surface/70">regtest</Chip>
        </div>

        <div className="mt-6">
          <p className="truncate text-[13px] font-semibold text-brand-ink" title={demo.config.name}>
            {demo.config.name}
          </p>
          <BalanceBlock fund={fund.data} pending={fund.isPending} error={fund.isError && !fund.data ? fund.error : null} retry={() => void fund.refetch()} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Button size="lg" icon={<IconSend size={18} />} onClick={() => nav.push({ name: "spend" })} disabled={!fund.data}>
            {t("Dépenser", "Spend")}
          </Button>
          <Button size="lg" variant="dark" icon={<IconUserPlus size={18} />} onClick={() => nav.sheet(<InviteSheet onClose={() => nav.sheet(null)} />)}>
            {t("Inviter", "Invite")}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-4 pt-5">
        {next?.request ? (
          <button
            type="button"
            onClick={() => nav.push({ name: "request", id: next.item.requestId })}
            className="press fade-up flex items-center gap-3 rounded-[22px] bg-ink p-3.5 text-left text-surface"
          >
            <span className="relative">
              <Avatar name={PEOPLE[next.request.requester].name} tone={PEOPLE[next.request.requester].tone} size={40} />
              <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-brand ring-2 ring-ink" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-semibold">
                {t(`${PEOPLE[next.request.requester].first} attend votre signature`, `${PEOPLE[next.request.requester].first} needs your signature`)}
              </span>
              <span className="block truncate text-[12.5px] opacity-70">
                <NextAmount amount={next.request.amount_xof} /> · {next.item.message?.purpose ?? next.request.purpose}
              </span>
            </span>
            {toSign.length > 1 ? <span className="rounded-full bg-surface/15 px-2 py-0.5 text-[12px] font-semibold">+{toSign.length - 1}</span> : null}
            <IconChevronRight size={18} className="shrink-0 opacity-60" />
          </button>
        ) : null}

        <section>
          <SectionTitle
            action={
              <button type="button" onClick={() => nav.push({ name: "activity" })} className="text-[13px] font-semibold text-brand hover:underline">
                {t("Voir tout", "See all")}
              </button>
            }
          >
            {t("Activité", "Activity")}
          </SectionTitle>
          <ActivityList fundId={demo.config.fundId} limit={5} />
        </section>
      </div>
    </div>
  );
}

function NextAmount({ amount }: { amount: string }) {
  const { lang } = usePrefs();
  return <span className="tabular">{xof(amount, lang)}</span>;
}

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

export function memberLink(fundId: string): string {
  return `${window.location.origin}/fonds/${fundId}`;
}

export function InviteSheet({ onClose }: { onClose: () => void }) {
  const { t } = usePrefs();
  const demo = useDemo();
  const toast = useToast();
  const link = memberLink(demo.config.fundId);
  const copy = () => {
    void navigator.clipboard?.writeText(link).then(
      () => toast({ tone: "good", title: t("Lien copié", "Link copied"), body: t("Collez-le dans le groupe WhatsApp.", "Paste it in the WhatsApp group.") }),
      () => toast({ tone: "bad", title: t("Copie impossible", "Could not copy"), detail: link }),
    );
  };
  return (
    <Sheet
      open
      contained
      onClose={onClose}
      title={t("Inviter les membres", "Invite members")}
      footer={
        <div className="flex flex-col gap-1">
          <Button size="lg" block icon={<IconCopy size={18} />} onClick={copy}>
            {t("Copier le lien", "Copy the link")}
          </Button>
          <a href={link} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center text-[14.5px] font-semibold text-ink-2 hover:text-ink">
            {t("Ouvrir la vue membre", "Open the member view")}
          </a>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pb-1">
        <p className="text-[14px] leading-snug text-ink-2">
          {t(
            "Chaque membre voit le solde et chaque mouvement, sans compte et sans clé. Personne ne peut dépenser depuis ce lien.",
            "Every member sees the balance and every movement, with no account and no key. Nobody can spend from this link.",
          )}
        </p>
        <div className="flex items-center gap-3 rounded-2xl bg-card p-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-brand">
            <IconLink size={18} />
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]" title={link}>
            {link.replace(/^https?:\/\//, "")}
          </span>
        </div>
      </div>
    </Sheet>
  );
}
