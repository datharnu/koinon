import { verifyAuditChain } from "@koinon/core/proof";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { endpoints, type FundView } from "../lib/http";
import { usePrefs } from "../lib/prefs";
import { useMembers } from "../lib/queries";
import { Chip, type ChipTone } from "../ui/avatar";
import { Button } from "../ui/button";
import { addressCheck, fingerprintStatus, type Fingerprint } from "./load";

export function proofScope(t: (fr: string, en: string) => string): string {
  return t(
    "Vérifié ici : empreinte du lien, chaîne d'audit SHA-256, adresses, script du témoin et signatures BIP143 (@noble/curves). Pas vérifié ici : les drapeaux de script de bitcoind, le compilateur miniscript, ni le nombre de blocs. Regtest.",
    "Checked here: the link fingerprint, the SHA-256 audit chain, addresses, the witness script, and BIP143 signatures (@noble/curves). Not checked here: bitcoind's script flags, the miniscript compiler, or the block count. Regtest.",
  );
}

export function MemberChecks({ fund }: { fund: FundView }) {
  const { t } = usePrefs();
  const fragment = window.location.hash.replace(/^#/, "");
  const finger = fingerprintStatus(fund, fragment);
  const members = useMembers(fund.id);
  const derived = members.data ? addressCheck(fund, members.data.members) : undefined;
  const audit = useQuery({
    queryKey: ["audit-local", fund.id],
    queryFn: async () => verifyAuditChain((await endpoints.audit(fund.id)).entries),
    refetchInterval: 30_000,
  });

  const keys = keyCopy(finger, t);
  const auditResult = audit.data;
  const auditCopy = audit.isPending
    ? { tone: "neutral" as const, title: t("Chaîne d'audit…", "Audit chain…"), body: t("Les lignes sont en train d'être relues.", "The rows are being read again.") }
    : audit.isError || !auditResult
      ? { tone: "warn" as const, title: t("Audit non vérifié", "Audit not checked"), body: t("Ce téléphone n'a pas pu lire le journal.", "This phone could not read the log.") }
      : auditResult.ok
        ? { tone: "good" as const, title: t(`Vérifié ici : ${auditResult.checked}/${auditResult.total}`, `Verified on this phone: ${auditResult.checked}/${auditResult.total}`), body: t("Chaque ligne reprend le hachage de la précédente.", "Each row carries the hash of the one before it.") }
        : { tone: "bad" as const, title: t(`Cassé au n°${auditResult.seq ?? "?"} · ${auditResult.checked}/${auditResult.total}`, `Broken at #${auditResult.seq ?? "?"} · ${auditResult.checked}/${auditResult.total}`), body: t("Une ligne ne correspond plus à la précédente.", "A row no longer matches the one before it.") };

  const addressCopy = !members.data
    ? { tone: "neutral" as const, title: t("Adresses…", "Addresses…"), body: t("Dérivation en cours.", "Deriving them.") }
    : members.isError
      ? { tone: "warn" as const, title: t("Adresses non vérifiées", "Addresses not checked"), body: t("La liste des membres n'est pas arrivée.", "The member list did not arrive.") }
      : !derived
        ? { tone: "bad" as const, title: t("Ces clés ne se dérivent pas", "These keys do not derive"), body: t("L'empreinte ne peut pas être recalculée.", "The fingerprint cannot be recomputed.") }
        : derived.badIndexes.length === 0 && derived.changeOk
          ? {
              tone: "good" as const,
              title: t(`Adresses recalculées : ${derived.memberMatches}/${derived.members}`, `Addresses re-derived: ${derived.memberMatches}/${derived.members}`),
              body: t("La monnaie de la caisse correspond aussi.", "The fund's change address matches too."),
            }
          : {
              tone: "bad" as const,
              title: t("Une adresse ne correspond pas", "An address does not match"),
              body: addressMismatch(derived, t),
            };

  return (
    <section aria-label={t("Vérifié sur ce téléphone", "Checked on this phone")} className="rounded-[22px] bg-card px-4 py-3.5" data-testid="member-proof">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-[14px] font-semibold">{t("Vérifié sur ce téléphone", "Checked on this phone")}</h3>
        <Chip tone={keys.tone} dot className="max-w-[46%] shrink">
          <span className="truncate">{keys.chip}</span>
        </Chip>
      </div>
      {finger === "mismatch" || finger === "invalid" ? (
        <p role="alert" className="mt-3 break-words rounded-2xl bg-bad-soft px-3 py-2.5 text-[13px] leading-snug text-bad">
          {keys.body}
        </p>
      ) : null}
      <ul className="mt-3 flex flex-col gap-3">
        <CheckRow tone={keys.tone} title={keys.title} body={finger === "match" || finger === "missing" ? keys.body : undefined} />
        <CheckRow tone={auditCopy.tone} title={auditCopy.title} body={auditCopy.body} action={audit.isError ? <Button size="sm" variant="secondary" onClick={() => void audit.refetch()}>{t("Réessayer", "Try again")}</Button> : undefined} />
        <CheckRow tone={addressCopy.tone} title={addressCopy.title} body={addressCopy.body} action={members.isError ? <Button size="sm" variant="secondary" onClick={() => void members.refetch()}>{t("Réessayer", "Try again")}</Button> : undefined} />
      </ul>
      <p className="mt-3 text-[12px] leading-snug text-ink-3">{proofScope(t)}</p>
    </section>
  );
}

function CheckRow({ tone, title, body, action }: { tone: ChipTone; title: string; body?: string; action?: ReactNode }) {
  const dot = { good: "bg-good", bad: "bg-bad", warn: "bg-warn", neutral: "bg-ink-3", brand: "bg-brand" }[tone];
  return (
    <li className="flex items-start gap-2.5">
      <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0 flex-1">
        <p className="break-words text-[13.5px] font-semibold leading-snug">{title}</p>
        {body ? <p className="mt-0.5 break-words text-[12.5px] leading-snug text-ink-2">{body}</p> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </li>
  );
}

function keyCopy(finger: Fingerprint, t: (fr: string, en: string) => string): { tone: ChipTone; chip: string; title: string; body: string } {
  if (finger === "match") {
    return {
      tone: "good",
      chip: t("Lien conforme", "Link matches"),
      title: t("Les clés correspondent à ce lien", "Keys match this link"),
      body: t("Les quatre clés publiques et le délai sont ceux du fragment #.", "The four public keys and the delay are the ones in the # fragment."),
    };
  }
  if (finger === "missing") {
    return {
      tone: "warn",
      chip: t("Sans empreinte", "No fingerprint"),
      title: t("Ce lien n'a pas d'empreinte", "No fingerprint in this link"),
      body: t("Un serveur modifié pourrait montrer d'autres clés. Demandez le lien qui se termine par #.", "A swapped server could show different keys. Ask for the link that ends with #."),
    };
  }
  if (finger === "invalid") {
    return {
      tone: "bad",
      chip: t("Empreinte illisible", "Bad fingerprint"),
      title: t("Cette empreinte n'est pas un hachage Koinon", "This fingerprint is not a Koinon hash"),
      body: t("Ne faites pas confiance aux noms de cette page.", "Do not trust the names on this page."),
    };
  }
  return {
    tone: "bad",
    chip: t("Clés différentes", "Keys differ"),
    title: t("Ces clés ne sont pas celles du lien", "These keys are not the ones in the link"),
    body: t("Ne faites pas confiance aux noms de cette page.", "Do not trust the names on this page."),
  };
}

function addressMismatch(
  derived: { badIndexes: number[]; changeOk: boolean; memberMatches: number; members: number },
  t: (fr: string, en: string) => string,
): string {
  const shown = derived.badIndexes.slice(0, 3).map((index) => `#${index}`).join(", ");
  const extra = derived.badIndexes.length > 3 ? ` +${derived.badIndexes.length - 3}` : "";
  const change = derived.changeOk ? t("La monnaie correspond.", "Change matches.") : t("La monnaie ne correspond pas.", "Change does not match.");
  if (derived.badIndexes.length === 0) return change;
  return t(`Membre ${shown}${extra}. ${change}`, `Member ${shown}${extra}. ${change}`);
}
