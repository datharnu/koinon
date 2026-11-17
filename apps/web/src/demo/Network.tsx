import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { endpoints, type RequestView } from "../lib/api";
import { DEMO_DUES_XOF, DEMO_MEMBERS, errorCode, errorMessage, mine, openSpend, payDues, recoverOne, signSpend, spendAlone, type NodeAnswer } from "../lib/flows";
import { xof } from "../lib/format";
import { PEOPLE } from "../lib/people";
import { usePrefs } from "../lib/prefs";
import { myRequests } from "../lib/vault";
import { Button, Spinner } from "../ui/button";
import { IconCheck, IconCoins, IconCube, IconLifebuoy, IconShield, IconSparkles, IconUsers } from "../ui/icons";
import { Sheet } from "../ui/sheet";
import { useToast } from "../ui/toast";
import { useDemo } from "./context";
import { useFund } from "./hooks";
import { Note, ScreenHeader, useNav } from "./ui";

function useInvalidate() {
  const demo = useDemo();
  const client = useQueryClient();
  return () => {
    demo.touch();
    void client.invalidateQueries({ queryKey: ["fund", demo.config.fundId] });
    void client.invalidateQueries({ queryKey: ["ledger", demo.config.fundId] });
    void client.invalidateQueries({ queryKey: ["request"] });
  };
}

/** The judge plays the network: mine blocks, have a member pay. */
export function useNetwork() {
  const { t, lang } = usePrefs();
  const demo = useDemo();
  const toast = useToast();
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState<"mine" | "dues" | null>(null);

  const mineBlocks = async (blocks = 1) => {
    setBusy("mine");
    try {
      const height = await mine(blocks);
      toast({ tone: "good", title: blocks === 1 ? t(`Bloc ${height} miné`, `Block ${height} mined`) : t(`${blocks} blocs minés`, `${blocks} blocks mined`), body: t("Les transactions en attente sont confirmées.", "Pending transactions are confirmed.") });
    } catch (error) {
      toast({ tone: "bad", title: t("Minage impossible", "Mining failed"), detail: errorCode(error) });
    } finally {
      setBusy(null);
      invalidate();
    }
  };

  const pay = async () => {
    setBusy("dues");
    const index = Math.floor(Math.random() * DEMO_MEMBERS.length);
    try {
      const txid = await payDues(demo.config, index, DEMO_DUES_XOF);
      toast({ tone: "good", title: t(`${DEMO_MEMBERS[index]} a cotisé ${xof(DEMO_DUES_XOF, lang)}`, `${DEMO_MEMBERS[index]} paid ${xof(DEMO_DUES_XOF, lang)}`), body: t("En attente du prochain bloc.", "Waiting for the next block."), detail: txid });
    } catch (error) {
      toast({ tone: "bad", title: t("Cotisation impossible", "Payment failed"), detail: errorCode(error) });
    } finally {
      setBusy(null);
      invalidate();
    }
  };

  return { busy, mineBlocks, pay };
}

export function FloatingToolbar({ onCheat }: { onCheat: () => void }) {
  const { t, lang } = usePrefs();
  const demo = useDemo();
  const fund = useFund(demo.config.fundId);
  const network = useNetwork();
  return (
    <div role="toolbar" aria-label={t("Réseau de test", "Test network")} className="fixed inset-x-0 bottom-5 z-30 flex justify-center px-4">
      <div className="flex items-center gap-1.5 rounded-full bg-surface p-1.5 shadow-[0_18px_50px_-18px_rgb(20_14_60/0.45)] ring-1 ring-line">
        <span className="flex h-10 items-center gap-2 rounded-full bg-card px-4 text-[13px] font-semibold text-ink-2" title={t("Hauteur de la chaîne regtest", "Regtest chain height")}>
          <IconCube size={16} />
          <span className="tabular">{fund.data ? t(`Bloc ${fund.data.chain_tip}`, `Block ${fund.data.chain_tip}`) : "…"}</span>
        </span>
        <Button variant="ghost" onClick={() => void network.mineBlocks(1)} busy={network.busy === "mine" ? t("Minage…", "Mining…") : false} disabled={network.busy !== null} icon={<IconCube size={17} />}>
          {t("Miner un bloc", "Mine a block")}
        </Button>
        <Button variant="ghost" onClick={() => void network.pay()} busy={network.busy === "dues" ? t("Paiement…", "Paying…") : false} disabled={network.busy !== null} icon={<IconCoins size={17} />}>
          {t(`Une cotisation de ${xof(DEMO_DUES_XOF, lang)}`, `A ${xof(DEMO_DUES_XOF, lang)} due`)}
        </Button>
        <span aria-hidden className="mx-1 h-6 w-px bg-line" />
        <Button onClick={onCheat} icon={<IconSparkles size={17} />}>
          {t("Essayer de tricher", "Try to cheat")}
        </Button>
      </div>
    </div>
  );
}

/** Mobile: the same controls in a sheet. */
export function NetworkSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = usePrefs();
  const demo = useDemo();
  const fund = useFund(demo.config.fundId);
  const network = useNetwork();
  return (
    <Sheet open={open} onClose={onClose} title={t("Réseau de test", "Test network")}>
      <div className="flex flex-col gap-5 pb-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3">
            <span className="text-[14px] text-ink-2">{t("Hauteur de la chaîne", "Chain height")}</span>
            <span className="tabular text-[15px] font-bold">{fund.data?.chain_tip ?? "…"}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => void network.mineBlocks(1)} busy={network.busy === "mine" ? t("Minage…", "Mining…") : false} disabled={network.busy !== null}>
              {t("Miner un bloc", "Mine a block")}
            </Button>
            <Button variant="secondary" onClick={() => void network.pay()} busy={network.busy === "dues" ? t("Paiement…", "Paying…") : false} disabled={network.busy !== null}>
              {t(`Cotiser ${xof(DEMO_DUES_XOF, lang)}`, `Pay ${xof(DEMO_DUES_XOF, lang)}`)}
            </Button>
          </div>
        </div>
        <div>
          <h3 className="pb-2 text-[13px] font-semibold text-ink-2">{t("Essayer de tricher", "Try to cheat")}</h3>
          <CheatList />
        </div>
      </div>
    </Sheet>
  );
}

export function CheatSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = usePrefs();
  return (
    <Sheet open={open} onClose={onClose} title={t("Essayer de tricher", "Try to cheat")}>
      <p className="pb-4 text-[14px] leading-snug text-ink-2">
        {t(
          "Chaque attaque part vraiment vers Bitcoin Core ou vers le téléphone d'un signataire. Le refus que vous voyez est le leur, mot pour mot.",
          "Each attack really goes to Bitcoin Core or to a signer's phone. The refusal you see is theirs, word for word.",
        )}
      </p>
      <div className="pb-2">
        <CheatList />
      </div>
    </Sheet>
  );
}

type Verdict =
  | { kind: "blocked"; title: string; detail?: string; next?: "mine-and-retry" }
  /** The legitimate path went through, as the policy intends. */
  | { kind: "intended"; title: string; detail?: string }
  | { kind: "allowed"; title: string; detail?: string }
  | { kind: "error"; title: string; detail: string };

function CheatList() {
  const { t } = usePrefs();
  const demo = useDemo();
  const toast = useToast();
  const invalidate = useInvalidate();
  const [running, setRunning] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});

  const attempt = async (id: string, step: string, action: (progress: (label: string) => void) => Promise<Verdict>) => {
    setRunning(id);
    setProgress(step);
    let verdict: Verdict;
    try {
      verdict = await action(setProgress);
    } catch (error) {
      verdict = { kind: "error", title: t("Pas de réponse claire", "No clear answer"), detail: `${errorCode(error)} · ${errorMessage(error)}` };
    }
    setVerdicts((current) => ({ ...current, [id]: verdict }));
    const good = verdict.kind === "blocked" || verdict.kind === "intended";
    toast({
      tone: good ? "good" : "bad",
      title:
        verdict.kind === "blocked"
          ? t("Attaque bloquée", "Attack blocked")
          : verdict.kind === "intended"
            ? t("Comme prévu", "As designed")
            : verdict.kind === "allowed"
              ? t("Accepté : à signaler", "Accepted: report this")
              : verdict.title,
      body: verdict.kind === "error" ? undefined : verdict.title,
      detail: verdict.detail,
    });
    setRunning(null);
    invalidate();
  };

  /** A pending request the treasurer opened and signed, or a fresh one. */
  const treasurerRequest = async (progress: (label: string) => void): Promise<{ request: RequestView; fresh: boolean }> => {
    for (const id of myRequests("O1")) {
      const request = await endpoints.request(id);
      if (request.status === "pending" && request.approvals.length === 1 && request.approvals[0]?.officer === "O1") return { request, fresh: false };
    }
    progress(t("Ibou ouvre une dépense…", "Ibou opens a spend…"));
    const purpose = t("Achat de chaises (test d'attaque)", "Buying chairs (attack test)");
    const created = await openSpend({ config: demo.config, role: "O1", secret: demo.secrets.O1, amountXof: 10_000, recipient: demo.config.vendorAddress, purpose });
    await signSpend({
      config: demo.config,
      role: "O1",
      secret: demo.secrets.O1,
      requester: "O1",
      read: { request_id: created.id, amount_xof: 10_000, amount_sats: created.amount_sats, recipient: demo.config.vendorAddress, purpose, expires_at: created.expires_at, path: "A" },
    });
    return { request: await endpoints.request(created.id), fresh: true };
  };

  const alone = () =>
    attempt("alone", t("Préparation…", "Preparing…"), async (progress) => {
      const { request } = await treasurerRequest(progress);
      progress(t("Envoi à Bitcoin Core…", "Sending to Bitcoin Core…"));
      const answer = await spendAlone({ config: demo.config, role: "O1", secret: demo.secrets.O1, request });
      return nodeVerdict(answer, t("Bitcoin Core refuse une transaction avec une seule signature.", "Bitcoin Core refuses a transaction with one signature."));
    });

  const swap = () =>
    attempt("swap", t("Préparation…", "Preparing…"), async (progress) => {
      const { request } = await treasurerRequest(progress);
      progress(t("Le serveur change le destinataire…", "The server swaps the recipient…"));
      // Same fields as Coumba's gift wrap: the treasurer typed them and this browser sent them.
      const decision = await signSpend({
        config: demo.config,
        role: "O2",
        secret: demo.secrets.O2,
        requester: request.requester,
        tamper: true,
        read: { request_id: request.id, amount_xof: Number(request.amount_xof), amount_sats: request.amount_sats, recipient: request.recipient, purpose: request.purpose, expires_at: request.expires_at, path: "A" },
      });
      if (decision.kind === "refused")
        return { kind: "blocked", title: t("Le téléphone de Coumba refuse de signer : la transaction ne paie pas le destinataire de la demande.", "Coumba's phone refuses to sign: the transaction does not pay the requested recipient."), detail: decision.code };
      if (decision.kind === "signed") return { kind: "allowed", title: t("Coumba a signé une transaction modifiée.", "Coumba signed a modified transaction.") };
      return { kind: "error", title: t("Demande ignorée", "Request ignored"), detail: decision.reason };
    });

  const early = () =>
    attempt("early", t("Une cotisation arrive…", "A due arrives…"), async (progress) => {
      await payDues(demo.config, 0, DEMO_DUES_XOF);
      await mine(1);
      progress(t("Attente du registre…", "Waiting for the ledger…"));
      await waitForLedger(demo.config.fundId);
      progress(t("Envoi à Bitcoin Core…", "Sending to Bitcoin Core…"));
      const answer = await recoverOne({ config: demo.config, officer: demo.secrets.O1, assembly: demo.secrets.K });
      if (answer.kind === "empty") return { kind: "error", title: t("Aucune pièce à récupérer", "No coin to recover"), detail: "EMPTY" };
      const verdict = nodeVerdict(answer, t(`Trop tôt : Bitcoin Core attend ${demo.config.csvBlocks} blocs après la cotisation.`, `Too early: Bitcoin Core waits ${demo.config.csvBlocks} blocks after the due.`));
      return verdict.kind === "blocked" ? { ...verdict, next: "mine-and-retry" } : verdict;
    });

  const later = () =>
    attempt("early", t(`Minage de ${demo.config.csvBlocks} blocs…`, `Mining ${demo.config.csvBlocks} blocks…`), async (progress) => {
      await mine(demo.config.csvBlocks);
      await waitForLedger(demo.config.fundId);
      progress(t("Envoi à Bitcoin Core…", "Sending to Bitcoin Core…"));
      const answer = await recoverOne({ config: demo.config, officer: demo.secrets.O1, assembly: demo.secrets.K });
      if (answer.kind === "empty") return { kind: "error", title: t("Aucune pièce à récupérer", "No coin to recover"), detail: "EMPTY" };
      if (answer.kind === "accepted")
        return { kind: "intended", title: t("Après le délai, Ibou et l'assemblée récupèrent la cotisation. C'est voulu : la porte de secours s'ouvre seulement maintenant.", "After the delay, Ibou and the assembly recover the due. That is intended: the emergency exit opens only now."), detail: answer.txid };
      return { kind: "error", title: t("Toujours refusé", "Still refused"), detail: answer.message };
    });

  const cards: { id: string; icon: ReactNode; title: string; body: string; run: () => void }[] = [
    {
      id: "alone",
      icon: <IconUsers size={20} />,
      title: t(`${PEOPLE.O1.first} dépense seul`, `${PEOPLE.O1.first} spends alone`),
      body: t("Le trésorier signe seul et envoie directement au nœud Bitcoin.", "The treasurer signs alone and sends straight to the Bitcoin node."),
      run: () => void alone(),
    },
    {
      id: "swap",
      icon: <IconShield size={20} />,
      title: t("Le serveur change le destinataire", "The server swaps the recipient"),
      body: t(`Le coordinateur modifie la transaction avant que ${PEOPLE.O2.first} ne signe.`, `The coordinator edits the transaction before ${PEOPLE.O2.first} signs.`),
      run: () => void swap(),
    },
    {
      id: "early",
      icon: <IconLifebuoy size={20} />,
      title: t("Récupérer trop tôt", "Recover too early"),
      body: t(`Une clé + l'assemblée, avant les ${demo.config.csvBlocks} blocs de délai.`, `One key + the assembly, before the ${demo.config.csvBlocks}-block delay.`),
      run: () => void early(),
    },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      {cards.map((card) => {
        const verdict = verdicts[card.id];
        const active = running === card.id;
        return (
          <article key={card.id} className="rounded-[22px] bg-card p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-ink">{card.icon}</span>
              <div className="min-w-0 flex-1">
                <h4 className="text-[15px] font-bold">{card.title}</h4>
                <p className="text-[13px] leading-snug text-ink-2">{card.body}</p>
              </div>
            </div>
            {verdict && !active ? <VerdictView verdict={verdict} /> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {active ? (
                <span className="flex h-9 items-center gap-2 text-[13.5px] font-semibold text-ink-2">
                  <Spinner size={16} />
                  {progress}
                </span>
              ) : verdict?.kind === "blocked" && verdict.next === "mine-and-retry" ? (
                <Button size="sm" variant="dark" onClick={() => void later()} disabled={running !== null}>
                  {t(`Miner ${demo.config.csvBlocks} blocs et réessayer`, `Mine ${demo.config.csvBlocks} blocks and retry`)}
                </Button>
              ) : (
                <Button size="sm" variant={verdict ? "secondary" : "dark"} className={verdict ? "bg-surface hover:bg-card-2" : ""} onClick={card.run} disabled={running !== null}>
                  {verdict ? t("Réessayer", "Try again") : t("Essayer", "Try it")}
                </Button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function VerdictView({ verdict }: { verdict: Verdict }) {
  const { t } = usePrefs();
  const [open, setOpen] = useState(false);
  const good = verdict.kind === "blocked" || verdict.kind === "intended";
  const label = { blocked: t("Bloqué", "Blocked"), intended: t("Comme prévu", "As designed"), allowed: t("Accepté", "Accepted"), error: t("Erreur", "Error") }[verdict.kind];
  return (
    <div className={`mt-3 rounded-2xl p-3 ${good ? "fade-up bg-good-soft text-good" : "shake bg-bad-soft text-bad"}`} role="status">
      <p className="flex items-center gap-1.5 text-[13px] font-bold">
        {good ? <IconCheck size={15} /> : <IconShield size={15} />}
        {label}
      </p>
      <p className="mt-0.5 text-[13px] leading-snug text-ink">{verdict.title}</p>
      {verdict.detail ? (
        <>
          <button type="button" onClick={() => setOpen(!open)} className="mt-1 text-[12.5px] font-semibold underline-offset-2 hover:underline">
            {open ? t("Masquer la réponse brute", "Hide the raw answer") : t("Voir la réponse brute", "See the raw answer")}
          </button>
          {open ? <p className="mt-1.5 break-all rounded-xl bg-surface/70 p-2 font-mono text-[11px] leading-relaxed text-ink-2">{verdict.detail}</p> : null}
        </>
      ) : null}
    </div>
  );
}

function nodeVerdict(answer: NodeAnswer, refusedTitle: string): Verdict {
  if (answer.kind === "refused") return { kind: "blocked", title: refusedTitle, detail: answer.message };
  return { kind: "allowed", title: "bitcoind accepted the transaction.", detail: answer.txid };
}

/** The coordinator learns about new blocks by polling; give it a moment. */
async function waitForLedger(fundId: string): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { entries } = await endpoints.ledger(fundId);
    if (entries.every((entry) => entry.confirmations > 0)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

export function RecoveryScreen({ role }: { role: "O1" | "O2" | "O3" }) {
  const { t } = usePrefs();
  const demo = useDemo();
  const nav = useNav();
  const toast = useToast();
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState<string | false>(false);
  const [result, setResult] = useState<Verdict | null>(null);

  const tryNow = async () => {
    setBusy(t("Envoi à Bitcoin Core…", "Sending to Bitcoin Core…"));
    setResult(null);
    try {
      const answer = await recoverOne({ config: demo.config, officer: demo.secrets[role], assembly: demo.secrets.K });
      const verdict: Verdict =
        answer.kind === "empty"
          ? { kind: "error", title: t("Aucune pièce de cotisation à récupérer.", "No contribution coin to recover."), detail: "EMPTY" }
          : answer.kind === "refused"
            ? { kind: "blocked", title: t(`Trop tôt : Bitcoin Core attend ${demo.config.csvBlocks} blocs après la cotisation la plus récente.`, `Too early: Bitcoin Core waits ${demo.config.csvBlocks} blocks after the newest due.`), detail: answer.message }
            : { kind: "intended", title: t("Accepté après le délai. La cotisation part vers l'adresse de l'assemblée.", "Accepted after the delay. The due goes to the assembly's address."), detail: answer.txid };
      setResult(verdict);
      if (answer.kind === "accepted") toast({ tone: "good", title: t("Récupération envoyée", "Recovery sent"), detail: answer.txid });
    } catch (error) {
      setResult({ kind: "error", title: t("Pas de réponse claire", "No clear answer"), detail: errorCode(error) });
    } finally {
      setBusy(false);
      invalidate();
    }
  };

  return (
    <>
      <ScreenHeader title={t("Récupération", "Recovery")} onBack={nav.back} />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <div className="flex flex-col items-center px-4 pb-5 pt-2 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-warn-soft text-warn">
            <IconLifebuoy size={30} />
          </span>
          <h2 className="mt-4 text-[22px] font-bold">{t("Si deux clés sont perdues", "If two keys are lost")}</h2>
          <p className="mt-2 text-[14.5px] leading-snug text-ink-2">
            {t(
              `Une clé du bureau et la clé de l'assemblée suffisent, mais seulement ${demo.config.csvBlocks} blocs après chaque cotisation. Avant, Bitcoin refuse.`,
              `One officer key and the assembly key are enough, but only ${demo.config.csvBlocks} blocks after each due. Before that, Bitcoin refuses.`,
            )}
          </p>
        </div>
        <ol className="flex flex-col gap-2">
          {[
            t(`La clé de ${PEOPLE[role].first}`, `${PEOPLE[role].first}'s key`),
            t("La clé de l'assemblée", "The assembly key"),
            t(`${demo.config.csvBlocks} blocs d'attente`, `${demo.config.csvBlocks} blocks of waiting`),
          ].map((label, index) => (
            <li key={label} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 text-[14.5px] font-semibold">
              <span className="tabular grid size-7 place-items-center rounded-full bg-surface text-[13px] text-ink-2">{index + 1}</span>
              {label}
            </li>
          ))}
        </ol>
        {result ? (
          <div className="mt-4">
            <VerdictView verdict={result} />
          </div>
        ) : (
          <div className="mt-4">
            <Note>{t("La démo tente la cotisation la plus récente : c'est celle que le délai retient encore.", "The demo tries the newest due: that is the one the delay still holds.")}</Note>
          </div>
        )}
      </div>
      <div className="shrink-0 border-t border-line bg-surface px-4 pb-4 pt-3">
        <Button size="lg" block onClick={() => void tryNow()} busy={busy}>
          {t("Tenter la récupération", "Attempt recovery")}
        </Button>
      </div>
    </>
  );
}
