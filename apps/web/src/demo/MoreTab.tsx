import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { endpoints } from "../lib/api";
import { errorCode, mine, recoverOne, type OfficerRole } from "../lib/flows";
import { middle } from "../lib/format";
import { usePrefs } from "../lib/prefs";
import { forgetFund } from "../lib/vault";
import { Button, ButtonLink } from "../ui/button";
import { Empty, QueryView } from "../ui/query";
import { Code, StatePill, type UiState } from "../ui/status";
import { LangToggle } from "../ui/toggles";
import { useDemo } from "./context";
import { useFund, useMembers } from "./hooks";

export function MoreTab({ role }: { role: OfficerRole }) {
  const { t } = usePrefs();
  const demo = useDemo();
  return (
    <div className="flex flex-col gap-3">
      <Recovery role={role} />
      <Audit />
      <Card title={t("Vue des membres", "Member view")} body={t("Lecture seule, sans clé : solde et registre. À partager dans le groupe WhatsApp.", "Read only, no key: balance and ledger. To share in the WhatsApp group.")}>
        <ButtonLink href={`/fonds/${demo.config.fundId}`} variant="secondary" size="sm" target="_blank" external arrow>
          {t("Ouvrir la vue", "Open the view")}
        </ButtonLink>
      </Card>
      <Members />
      <section className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] bg-panel p-4 hairline">
        <h3 className="text-[14px] font-semibold tracking-normal">{t("Langue", "Language")}</h3>
        <LangToggle />
      </section>
      <Reset />
    </div>
  );
}

function Card({ title, body, children }: { title: string; body?: ReactNode; children?: ReactNode }) {
  return (
    <section className="flex flex-col items-start gap-2 rounded-[var(--radius-card)] bg-panel p-4 hairline">
      <h3 className="text-[14px] font-semibold tracking-normal">{title}</h3>
      {body ? <div className="text-[13px] leading-snug text-text-2">{body}</div> : null}
      {children}
    </section>
  );
}

function Recovery({ role }: { role: OfficerRole }) {
  const { t } = usePrefs();
  const demo = useDemo();
  const client = useQueryClient();
  const fund = useFund(demo.config.fundId);
  const [busy, setBusy] = useState<string | false>(false);
  const [result, setResult] = useState<{ state: UiState; text: string; detail?: string } | null>(null);

  const attempt = async () => {
    setBusy(t("Envoi au nœud…", "Sending to the node…"));
    setResult(null);
    try {
      const answer = await recoverOne({ config: demo.config, officer: demo.secrets[role], assembly: demo.secrets.K });
      const next =
        answer.kind === "empty"
          ? { state: "UNKNOWN" as const, text: t("Aucune pièce de cotisation à récupérer.", "No contribution coin left to recover.") }
          : answer.kind === "refused"
            ? { state: "REFUSE" as const, text: t(`Trop tôt : bitcoind refuse avant ${demo.config.csvBlocks} blocs.`, `Too early: bitcoind refuses before ${demo.config.csvBlocks} blocks.`), detail: answer.message }
            : {
                state: "ALLOW" as const,
                text: t("Accepté : une clé du bureau + l'assemblée, après le délai. Minez un bloc pour le confirmer.", "Accepted: one officer key + the assembly, after the delay. Mine a block to confirm it."),
                detail: answer.txid,
              };
      setResult(next);
      demo.log({ actor: role, state: next.state, title: t("Récupération (chemin B)", "Recovery (path B)"), detail: next.detail ?? next.text });
    } catch (error) {
      const code = errorCode(error);
      setResult({ state: "UNKNOWN", text: t("Pas de réponse claire.", "No clear answer."), detail: code });
    } finally {
      setBusy(false);
      demo.touch();
      void client.invalidateQueries({ queryKey: ["ledger", demo.config.fundId] });
    }
  };

  const advance = async () => {
    setBusy(t("Minage…", "Mining…"));
    try {
      const height = await mine(demo.config.csvBlocks);
      demo.log({ actor: "net", state: "ALLOW", title: t(`${demo.config.csvBlocks} blocs minés`, `${demo.config.csvBlocks} blocks mined`), detail: `height ${height}` });
    } catch (error) {
      demo.log({ actor: "net", state: "UNKNOWN", title: t("Minage impossible", "Mining failed"), detail: errorCode(error) });
    } finally {
      setBusy(false);
      void client.invalidateQueries({ queryKey: ["fund", demo.config.fundId] });
    }
  };

  return (
    <Card
      title={t("Récupération", "Recovery")}
      body={t(
        `Si deux clés sont perdues : une clé du bureau + la clé de l'assemblée, mais seulement ${demo.config.csvBlocks} blocs après la cotisation. Bitcoin refuse avant. La démo essaie la cotisation la plus récente.`,
        `If two keys are lost: one officer key + the assembly key, but only ${demo.config.csvBlocks} blocks after the due. Bitcoin refuses before. The demo tries the newest due.`,
      )}
    >
      <div className="flex w-full flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => void attempt()} busy={busy} disabled={fund.isPending}>
          {t("Tenter maintenant", "Try now")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void advance()} disabled={Boolean(busy)}>
          {t(`+${demo.config.csvBlocks} blocs`, `+${demo.config.csvBlocks} blocks`)}
        </Button>
      </div>
      {result ? (
        <div role="status" className={`flex w-full flex-col gap-1.5 rounded-[var(--radius-ctl)] bg-raise p-3 hairline ${result.state === "REFUSE" ? "shake" : "arrive"}`}>
          <StatePill state={result.state}>{result.state}</StatePill>
          <p className="text-[13px] leading-snug">{result.text}</p>
          {result.detail ? <p className="break-all font-mono text-[11px] text-text-2">{result.detail}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}

function Audit() {
  const { t } = usePrefs();
  const demo = useDemo();
  const audit = useQuery({ queryKey: ["audit", demo.config.fundId], queryFn: () => endpoints.auditVerify(demo.config.fundId), enabled: false });
  return (
    <Card
      title={t("Journal d'audit", "Audit log")}
      body={t("Chaque action est chaînée par hachage. Une ligne modifiée casse la chaîne.", "Every action is hash-chained. One edited line breaks the chain.")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => void audit.refetch()} busy={audit.isFetching ? t("Vérification…", "Checking…") : false}>
          {t("Vérifier la chaîne", "Verify the chain")}
        </Button>
        {audit.data ? (
          audit.data.ok ? (
            <StatePill state="ALLOW">{t("chaîne intacte", "chain intact")}</StatePill>
          ) : (
            <StatePill state="REFUSE">{t(`cassée à #${audit.data.seq ?? "?"}`, `broken at #${audit.data.seq ?? "?"}`)}</StatePill>
          )
        ) : null}
        {audit.isError ? <Code>{errorCode(audit.error)}</Code> : null}
      </div>
    </Card>
  );
}

function Members() {
  const { t } = usePrefs();
  const demo = useDemo();
  const members = useMembers(demo.config.fundId);
  const [open, setOpen] = useState(false);
  return (
    <Card title={t("Membres", "Members")} body={t("Chaque membre a sa propre adresse de cotisation.", "Each member has their own dues address.")}>
      <QueryView query={members}>
        {(data) =>
          data.members.length === 0 ? (
            <Empty title={t("Aucun membre.", "No members.")} />
          ) : (
            <div className="w-full">
              <ul className="flex w-full flex-col">
                {(open ? data.members : data.members.slice(0, 4)).map((member) => (
                  <li key={member.index} className="flex items-center justify-between gap-3 border-t border-line py-2 first:border-t-0">
                    <span className="min-w-0 truncate text-[13px]" title={member.pseudonym}>
                      <span className="font-mono text-text-3">#{member.index}</span> {member.pseudonym}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-text-3" title={member.address}>
                      {middle(member.address, 6)}
                    </span>
                  </li>
                ))}
              </ul>
              {data.members.length > 4 ? (
                <button type="button" onClick={() => setOpen(!open)} className="mt-1 text-[13px] font-medium text-brand hover:underline">
                  {open ? t("Réduire", "Show less") : t(`Voir les ${data.members.length}`, `Show all ${data.members.length}`)}
                </button>
              ) : null}
            </div>
          )
        }
      </QueryView>
    </Card>
  );
}

function Reset() {
  const { t } = usePrefs();
  const [confirm, setConfirm] = useState(false);
  return (
    <Card title={t("Recommencer", "Start over")} body={t("Efface les clés de démo de ce navigateur. Le fonds regtest reste sur le serveur.", "Erases the demo keys from this browser. The regtest fund stays on the server.")}>
      {confirm ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              forgetFund();
              window.location.assign("/app");
            }}
          >
            {t("Effacer les clés", "Erase the keys")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
            {t("Annuler", "Cancel")}
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
          {t("Effacer…", "Erase…")}
        </Button>
      )}
    </Card>
  );
}
