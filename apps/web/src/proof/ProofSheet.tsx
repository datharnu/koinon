import type { OutputView } from "@koinon/core/proof";
import type { LedgerEntry } from "../lib/http";
import { sats } from "../lib/format";
import { usePrefs } from "../lib/prefs";
import { useFund } from "../lib/queries";
import { Chip } from "../ui/avatar";
import { Button } from "../ui/button";
import { Sheet } from "../ui/sheet";
import { ErrorState, Skeleton } from "../ui/states";
import { useToast } from "../ui/toast";
import { fingerprintStatus, useInspection } from "./load";
import { proofScope } from "./MemberChecks";
import { whoSigned } from "./names";

export function ProofSheet({ fundId, entry, onClose }: { fundId: string; entry: LedgerEntry | null; onClose: () => void }) {
  const { t, lang } = usePrefs();
  const fund = useFund(fundId);
  const proof = useInspection(fundId, entry?.txid ?? null);
  const toast = useToast();
  const open = entry !== null;

  const copy = () => {
    if (!entry) return;
    void navigator.clipboard?.writeText(entry.txid).then(
      () => toast({ tone: "info", title: t("Txid copié", "Txid copied") }),
      () => toast({ tone: "bad", title: t("Copie impossible", "Could not copy"), detail: entry.txid }),
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("Preuve Bitcoin", "Bitcoin proof")}
      footer={
        <Button variant="secondary" size="lg" block onClick={onClose}>
          {t("Fermer", "Close")}
        </Button>
      }
    >
      {!entry ? null : proof.isPending || fund.isPending ? (
        <div className="flex flex-col gap-3 pb-2" aria-busy="true">
          <Skeleton className="h-16" />
          <Skeleton className="h-24" />
          <Skeleton className="h-10" />
        </div>
      ) : proof.isError || !proof.data || !fund.data ? (
        <ErrorState error={proof.error ?? fund.error} onRetry={() => void proof.refetch()} title={t("Preuve illisible", "Proof unreadable")} />
      ) : (
        <ProofBody
          entry={entry}
          who={
            proof.data.inspection.signers.length
              ? namedSigners(fund.data, proof.data.inspection.signers, lang)
              : ""
          }
          namesChecked={fingerprintStatus(fund.data, window.location.hash.replace(/^#/, ""))}
          path={proof.data.inspection.path}
          csv={fund.data.csv_blocks}
          ok={proof.data.inspection.ok}
          direction={proof.data.inspection.direction}
          reason={proof.data.inspection.reason}
          outputs={proof.data.inspection.outputs}
          fee={proof.data.inspection.feeSats}
          confirmations={proof.data.confirmations}
          txid={proof.data.inspection.txid}
          onCopy={copy}
        />
      )}
    </Sheet>
  );
}

function ProofBody({
  entry,
  who,
  namesChecked,
  path,
  csv,
  ok,
  direction,
  reason,
  outputs,
  fee,
  confirmations,
  txid,
  onCopy,
}: {
  entry: LedgerEntry;
  who: string;
  namesChecked: "missing" | "invalid" | "match" | "mismatch";
  path: "A" | "B" | "unproven";
  csv: number;
  ok: boolean;
  direction: "spend" | "contribution" | "unrelated";
  reason: string | null;
  outputs: OutputView[];
  fee: string | null;
  confirmations: number | null;
  txid: string;
  onCopy: () => void;
}) {
  const { t, lang } = usePrefs();
  const spendOk = ok && direction === "spend";
  const paidIn = direction === "contribution" && ok;
  const verdict = spendOk
    ? t("Vérifié sur ce téléphone à partir des octets Bitcoin, pas de la base du serveur.", "Checked on this phone from Bitcoin bytes, not from the server's database.")
    : paidIn
      ? t("Ce téléphone a vérifié qu'une sortie paie un script dérivé des clés de la caisse. Une entrée n'a pas besoin de signature d'un responsable.", "This phone checked that an output pays a script derived from the fund keys. A payment in does not need an officer signature.")
      : (reason ?? t("Cette transaction n'est pas prouvée.", "This transaction is not proven."));
  const tone = spendOk || paidIn ? "good" : "bad";
  const pathLabel =
    path === "A"
      ? t("2 sur 3", "2-of-3")
      : path === "B"
        ? t(`Récupération après ${csv} blocs`, `Recovery after ${csv} blocks`)
        : t("Chemin non prouvé", "Path not proven");
  const scriptLabel = path === "B" ? t("P2WSH récupération + CSV", "P2WSH recovery + CSV") : path === "A" ? "P2WSH 2-of-3 + CSV" : t("Script non reconnu", "Script not recognised");

  return (
    <div className="flex flex-col gap-4 pb-2">
      <p role="status" data-testid="proof-verdict" className={`break-words rounded-2xl px-3.5 py-3 text-[13.5px] leading-snug ${tone === "good" ? "bg-good-soft text-ink" : "bg-bad-soft text-ink"}`}>
        {verdict}
      </p>
      <div className="min-w-0">
        <p className="break-words text-[20px] font-bold leading-tight tracking-[-0.02em]">{who || (paidIn ? t("Cotisation", "Contribution") : t("Signataires non prouvés", "Signers not proven"))}</p>
        <p className="mt-1 break-words text-[13px] text-ink-3">
          {entry.kind === "spend" ? pathLabel : t("Vers la caisse", "Into the fund")}
        </p>
        {namesChecked === "match" ? null : (
          <p className="mt-2 break-words text-[12.5px] leading-snug text-warn">
            {namesChecked === "missing"
              ? t("Cette page n'a pas d'empreinte dans l'adresse. Les noms sont les étiquettes du serveur.", "This page has no fingerprint in the address. The names are the server's labels.")
              : t("L'empreinte du lien ne correspond pas. Les rôles sont O1, O2, O3 et K, pas des noms.", "The link's fingerprint does not match. The roles are O1, O2, O3, and K, not names.")}
          </p>
        )}
      </div>
      <div className="flex flex-col items-start gap-2">
        <Chip tone={tone === "good" ? "good" : "bad"} dot>
          {scriptLabel}
        </Chip>
        <Confirmations count={confirmations} />
      </div>
      <ul className="flex flex-col divide-y divide-line rounded-[20px] bg-card px-3.5">
        {outputs.length === 0 ? (
          <li className="py-3 text-[13.5px] text-ink-2">{t("Aucune sortie lisible.", "No readable output.")}</li>
        ) : (
          outputs.map((output, index) => (
            <li key={`${output.role}-${output.index ?? "x"}-${index}`} className="flex items-start justify-between gap-3 py-3">
              <span className="min-w-0 break-words text-[14px]">{outputRole(output, t)}</span>
              <span className="tabular shrink-0 text-[14px] font-semibold">{sats(output.sats, lang)} sats</span>
            </li>
          ))
        )}
        {fee ? (
          <li className="flex items-center justify-between gap-3 py-3">
            <span className="text-[14px] text-ink-2">{t("Frais", "Fee")}</span>
            <span className="tabular text-[14px] font-semibold">{sats(fee, lang)} sats</span>
          </li>
        ) : null}
      </ul>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">txid</p>
          <button type="button" onClick={onCopy} className="press text-[13px] font-semibold text-brand">
            {t("Copier", "Copy")}
          </button>
        </div>
        <p className="mt-1 break-all font-mono text-[12px] leading-relaxed text-ink-2">{txid}</p>
      </div>
      <p className="text-[12px] leading-snug text-ink-3">{proofScope(t)}</p>
    </div>
  );
}

function Confirmations({ count }: { count: number | null }) {
  const { t } = usePrefs();
  if (count === null) return <p className="break-words text-[12.5px] font-semibold text-ink-3">{t("Confirmations non rapportées", "Confirmations not reported")}</p>;
  if (count === 0) {
    return <p className="break-words text-[12.5px] font-semibold text-warn">{t("Mempool · 0 confirmation. Chiffre du coordinateur, pas compté ici.", "Mempool · 0 confirmations. The coordinator's number, not counted here.")}</p>;
  }
  const label = count === 1 ? t("1 confirmation", "1 confirmation") : t(`${count} confirmations`, `${count} confirmations`);
  return <p className="break-words text-[12.5px] font-semibold text-ink-2">{t(`${label}. Chiffre du coordinateur, pas compté ici.`, `${label}. The coordinator's number, not counted here.`)}</p>;
}

function namedSigners(fund: Parameters<typeof whoSigned>[0], roles: Parameters<typeof whoSigned>[1], lang: Parameters<typeof whoSigned>[2]): string {
  const finger = fingerprintStatus(fund, window.location.hash.replace(/^#/, ""));
  if (finger === "mismatch" || finger === "invalid") return roles.join(" + ");
  return whoSigned(fund, roles, lang);
}

function outputRole(output: OutputView, t: (fr: string, en: string) => string): string {
  if (output.role === "change") return t("Monnaie, retour à la caisse", "Change, back to the fund");
  if (output.role === "member") return t(`Membre #${output.index ?? "?"}`, `Member #${output.index ?? "?"}`);
  return t("Sort de la caisse", "Leaves the fund");
}
