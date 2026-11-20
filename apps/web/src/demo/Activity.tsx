import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LedgerEntry } from "../lib/http";
import { sats, xof } from "../lib/format";
import { memberTone } from "../lib/people";
import { usePrefs } from "../lib/prefs";
import { useFund, useLedger, useMembers, useRequest } from "../lib/queries";
import { Avatar } from "../ui/avatar";
import { IconCoins, IconLifebuoy, IconSend } from "../ui/icons";
import { EmptyState, ErrorState, Skeleton } from "../ui/states";
import { ProofSheet } from "../proof/ProofSheet";
import { useDemoOptional } from "./context";
import { fingerprintStatus, localFingerprint, useInspection } from "../proof/load";
import { whoSigned } from "../proof/names";
import { Group, IconBubble, Row } from "./ui";

/** Newest first; unconfirmed on top, the way a bank shows pending lines. */
function ordered(entries: LedgerEntry[]): LedgerEntry[] {
  return [...entries].sort((a, b) => a.confirmations - b.confirmations || b.seen_at.localeCompare(a.seen_at));
}

/** `openTxid` opens that transaction's proof once it is in the ledger: the receipt link from an officer's phone. */
export function ActivityList({ fundId, limit, emptyAction, openTxid }: { fundId: string; limit?: number; emptyAction?: ReactNode; openTxid?: string }) {
  const { t } = usePrefs();
  const ledger = useLedger(fundId);
  const members = useMembers(fundId);
  const [selected, setSelected] = useState<LedgerEntry | null>(null);
  const opened = useRef(false);
  useEffect(() => {
    if (!openTxid || opened.current || !ledger.data) return;
    const entry = ledger.data.entries.find((item) => item.txid === openTxid && item.kind === "spend");
    if (!entry) return;
    opened.current = true;
    setSelected(entry);
  }, [openTxid, ledger.data]);
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
    <>
      <Group>
        {shown.map((entry) =>
          entry.kind === "contribution" ? (
            <ContributionRow key={`${entry.txid}:${entry.vout}`} entry={entry} name={entry.index !== null ? names.get(entry.index) : undefined} onOpen={() => setSelected(entry)} />
          ) : (
            <SpendRow
              key={entry.txid}
              fundId={fundId}
              entry={entry}
              recovered={(entry.indexes ?? []).flatMap((index) => {
                const name = names.get(index);
                return name ? [{ index, name }] : [];
              })}
              onOpen={() => setSelected(entry)}
            />
          ),
        )}
      </Group>
      <ProofSheet fundId={fundId} entry={selected} onClose={() => setSelected(null)} />
    </>
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

function ContributionRow({ entry, name, onOpen }: { entry: LedgerEntry; name?: string; onOpen: () => void }) {
  const { t, lang } = usePrefs();
  const label = name ?? t(`Membre #${entry.index ?? "?"}`, `Member #${entry.index ?? "?"}`);
  return (
    <Row
      testId={`activity-${entry.txid}`}
      onClick={onOpen}
      chevron
      icon={<Avatar name={label} tone={memberTone(entry.index ?? 0)} />}
      title={label}
      subtitle={<Confirmations count={entry.confirmations} />}
      right={
        <span className="flex flex-col items-end">
          <span className="tabular whitespace-nowrap text-[15px] font-semibold text-good">+{entry.xof_at_receipt ? xof(entry.xof_at_receipt, lang) : `${sats(entry.sats, lang)} sats`}</span>
          <span className="whitespace-nowrap text-[12px] text-ink-3">{t("Preuve Bitcoin", "Bitcoin proof")}</span>
        </span>
      }
    />
  );
}

function SpendRow({ fundId, entry, recovered = [], onOpen }: { fundId: string; entry: LedgerEntry; recovered?: { index: number; name: string }[]; onOpen: () => void }) {
  const { t, lang } = usePrefs();
  if (!entry.request_id) {
    const who = recovered.map((item) => item.name).join(", ");
    const first = recovered[0];
    return (
      <Row
        testId={`activity-${entry.txid}`}
        onClick={onOpen}
        chevron
        icon={
          first ? (
            <Avatar name={first.name} tone={memberTone(first.index)} />
          ) : (
            <IconBubble tone="warn">
              <IconLifebuoy size={18} />
            </IconBubble>
          )
        }
        title={who ? t(`${who} · récupération`, `${who} · recovery`) : t("Récupération par l'assemblée", "Assembly recovery")}
        subtitle={<Confirmations count={entry.confirmations} />}
        right={
          <span className="flex flex-col items-end">
            <span className="tabular whitespace-nowrap text-[15px] font-semibold">
              −{entry.xof_at_receipt ? xof(entry.xof_at_receipt, lang) : `${sats(entry.sats, lang)} sats`}
            </span>
            <SignerLine fundId={fundId} txid={entry.txid} />
          </span>
        }
      />
    );
  }
  return <RequestedSpendRow fundId={fundId} entry={entry} requestId={entry.request_id} onOpen={onOpen} />;
}

function RequestedSpendRow({ fundId, entry, requestId, onOpen }: { fundId: string; entry: LedgerEntry; requestId: string; onOpen: () => void }) {
  const { t, lang } = usePrefs();
  const request = useRequest(requestId);
  return (
    <Row
      testId={`activity-${entry.txid}`}
      onClick={onOpen}
      chevron
      icon={
        <IconBubble>
          <IconSend size={18} />
        </IconBubble>
      }
      title={request.data?.purpose ?? t("Dépense", "Spend")}
      subtitle={<Confirmations count={entry.confirmations} />}
      right={
        <span className="flex flex-col items-end">
          <span className="tabular whitespace-nowrap text-[15px] font-semibold">−{request.data ? xof(request.data.amount_xof, lang) : `${sats(entry.sats, lang)} sats`}</span>
          <SignerLine fundId={fundId} txid={entry.txid} />
        </span>
      }
    />
  );
}

/** Who signed, read from the witness. The old row said "2 signatures" without looking. */
function SignerLine({ fundId, txid }: { fundId: string; txid: string }) {
  const { t, lang } = usePrefs();
  const fund = useFund(fundId);
  const demo = useDemoOptional();
  const proof = useInspection(fundId, txid);
  let label = t("Preuve Bitcoin", "Bitcoin proof");
  if (proof.isError) label = t("Preuve indisponible", "Proof unavailable");
  else if (proof.data && fund.data) {
    const seen = proof.data.inspection;
    if (seen.ok && seen.direction === "spend" && seen.signers.length > 0) {
      const path = seen.path === "B" ? t("récupération", "recovery") : t("2 sur 3", "2-of-3");
      const finger = fingerprintStatus(fund.data, window.location.hash.replace(/^#/, ""), demo ? localFingerprint(demo.config) : null);
      const who = finger === "mismatch" || finger === "invalid" ? seen.signers.join(" + ") : whoSigned(fund.data, seen.signers, lang);
      label = `${who} · ${path}`;
    } else if (!seen.ok) label = t("Non prouvée", "Not proven");
  }
  return (
    <span className="max-w-[9.5rem] truncate text-right text-[12px] text-ink-3" title={label}>
      {label}
    </span>
  );
}
