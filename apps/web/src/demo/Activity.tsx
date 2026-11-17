import type { ReactNode } from "react";
import type { LedgerEntry } from "../lib/api";
import { sats, xof } from "../lib/format";
import { memberTone } from "../lib/people";
import { usePrefs } from "../lib/prefs";
import { Avatar } from "../ui/avatar";
import { IconCoins, IconLifebuoy, IconSend } from "../ui/icons";
import { EmptyState, ErrorState, Skeleton } from "../ui/states";
import { useLedger, useMembers, useRequest } from "./hooks";
import { Group, IconBubble, Row } from "./ui";

/** Newest first; unconfirmed on top, the way a bank shows pending lines. */
function ordered(entries: LedgerEntry[]): LedgerEntry[] {
  return [...entries].sort((a, b) => a.confirmations - b.confirmations || b.seen_at.localeCompare(a.seen_at));
}

export function ActivityList({ fundId, limit, emptyAction }: { fundId: string; limit?: number; emptyAction?: ReactNode }) {
  const { t } = usePrefs();
  const ledger = useLedger(fundId);
  const members = useMembers(fundId);
  if (ledger.isPending) {
    return (
      <Group className="flex flex-col gap-3 p-4">
        {[0, 1, 2].map((key) => (
          <div key={key} className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-2/3 rounded-md" />
              <Skeleton className="h-3 w-1/3 rounded-md" />
            </div>
            <Skeleton className="h-4 w-16 rounded-md" />
          </div>
        ))}
      </Group>
    );
  }
  if (ledger.isError && !ledger.data) return <ErrorState error={ledger.error} onRetry={() => void ledger.refetch()} />;
  const entries = ordered(ledger.data.entries);
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<IconCoins size={24} />}
        title={t("Pas encore d'activité", "No activity yet")}
        body={t("Les cotisations apparaissent ici dès que le réseau les voit.", "Dues show up here as soon as the network sees them.")}
        action={emptyAction}
      />
    );
  }
  const names = new Map((members.data?.members ?? []).map((member) => [member.index, member.pseudonym]));
  const shown = limit ? entries.slice(0, limit) : entries;
  return (
    <Group>
      {shown.map((entry) =>
        entry.kind === "contribution" ? (
          <ContributionRow key={`${entry.txid}:${entry.vout}`} entry={entry} name={entry.index !== null ? names.get(entry.index) : undefined} />
        ) : (
          <SpendRow key={entry.txid} entry={entry} />
        ),
      )}
    </Group>
  );
}

function Confirmations({ count }: { count: number }) {
  const { t } = usePrefs();
  if (count === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-warn">
        <span aria-hidden className="pulse-soft size-1.5 rounded-full bg-current" />
        {t("En attente du réseau", "Waiting for the network")}
      </span>
    );
  }
  return <>{count === 1 ? t("1 confirmation", "1 confirmation") : t(`${count} confirmations`, `${count} confirmations`)}</>;
}

function ContributionRow({ entry, name }: { entry: LedgerEntry; name?: string }) {
  const { t, lang } = usePrefs();
  const label = name ?? t(`Membre #${entry.index ?? "?"}`, `Member #${entry.index ?? "?"}`);
  return (
    <Row
      icon={<Avatar name={label} tone={memberTone(entry.index ?? 0)} />}
      title={label}
      subtitle={<Confirmations count={entry.confirmations} />}
      right={
        <span className="flex flex-col items-end">
          <span className="tabular text-[15px] font-semibold text-good">+{entry.xof_at_receipt ? xof(entry.xof_at_receipt, lang) : `${sats(entry.sats, lang)} sats`}</span>
          <span className="tabular text-[12px] text-ink-3">{sats(entry.sats, lang)} sats</span>
        </span>
      }
    />
  );
}

function SpendRow({ entry }: { entry: LedgerEntry }) {
  const { t, lang } = usePrefs();
  if (!entry.request_id) {
    return (
      <Row
        icon={
          <IconBubble tone="warn">
            <IconLifebuoy size={18} />
          </IconBubble>
        }
        title={t("Récupération par l'assemblée", "Assembly recovery")}
        subtitle={<Confirmations count={entry.confirmations} />}
        right={<span className="tabular text-[15px] font-semibold">−{sats(entry.sats, lang)} sats</span>}
      />
    );
  }
  return <RequestedSpendRow entry={entry} requestId={entry.request_id} />;
}

function RequestedSpendRow({ entry, requestId }: { entry: LedgerEntry; requestId: string }) {
  const { t, lang } = usePrefs();
  const request = useRequest(requestId);
  return (
    <Row
      icon={
        <IconBubble>
          <IconSend size={18} />
        </IconBubble>
      }
      title={request.data?.purpose ?? t("Dépense", "Spend")}
      subtitle={<Confirmations count={entry.confirmations} />}
      right={
        <span className="flex flex-col items-end">
          <span className="tabular text-[15px] font-semibold">−{request.data ? xof(request.data.amount_xof, lang) : `${sats(entry.sats, lang)} sats`}</span>
          <span className="tabular text-[12px] text-ink-3">{t("2 signatures", "2 signatures")}</span>
        </span>
      }
    />
  );
}
