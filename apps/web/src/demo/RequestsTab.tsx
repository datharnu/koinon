import type { Role } from "@koinon/core";
import type { ParsedMessage } from "@koinon/nostr";
import { useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useId, useState } from "react";
import type { RequestStatus, RequestView } from "../lib/api";
import { broadcast, errorCode, errorMessage, rejectSpend, signSpend, spendAlone, type OfficerRole } from "../lib/flows";
import { middle, relative, sats, xof } from "../lib/format";
import { usePrefs } from "../lib/prefs";
import { Button } from "../ui/button";
import { Locks } from "../ui/motif";
import { Empty, ErrorNote } from "../ui/query";
import { Code, StatePill, type UiState } from "../ui/status";
import { useDemo } from "./context";
import { useRequest, type InboxItem } from "./hooks";
import { roleLabel } from "./PhoneApp";

type InboxQuery = UseQueryResult<{ items: InboxItem[]; replies: ParsedMessage[] }>;

export function RequestsTab({ role, inbox, onCompose }: { role: OfficerRole; inbox: InboxQuery; onCompose: () => void }) {
  const { t } = usePrefs();
  const client = useQueryClient();
  if (inbox.isPending) return <SkeletonCards />;
  if (inbox.isError && !inbox.data) return <ErrorNote error={inbox.error} onRetry={() => void inbox.refetch()} />;
  const created = (id: string) => client.getQueryData<RequestView>(["request", id])?.created_at ?? "9999";
  const items = [...(inbox.data?.items ?? [])].sort((a, b) => created(b.requestId).localeCompare(created(a.requestId)));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[14px] font-semibold tracking-normal">{t("Demandes", "Requests")}</h3>
        <span className="font-mono text-[11px] text-text-3">{inbox.isFetching ? t("relais…", "relay…") : t("via Nostr", "via Nostr")}</span>
      </div>
      {items.length === 0 ? (
        <Empty
          title={t("Aucune demande.", "No requests.")}
          body={t(
            "Une demande ouverte par un autre membre du bureau arrive ici, chiffrée de bout en bout par le relais Nostr.",
            "A request opened by another officer lands here, end-to-end encrypted through the Nostr relay.",
          )}
          action={
            <Button size="sm" variant="secondary" onClick={onCompose}>
              {t("Ouvrir une dépense", "Open a spend")}
            </Button>
          }
        />
      ) : (
        items.map((item) => <RequestCard key={item.requestId} role={role} item={item} />)
      )}
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      {[0, 1].map((key) => (
        <div key={key} className="h-36 animate-pulse rounded-[var(--radius-card)] bg-panel hairline motion-reduce:animate-none" />
      ))}
    </div>
  );
}

interface Outcome {
  state: UiState;
  title: string;
  code?: string;
  detail?: string;
  /** The request status once the action settled. A newer status makes the note history. */
  status?: RequestStatus;
}

const statusState: Record<RequestStatus, UiState> = {
  draft: "PENDING",
  pending: "PENDING",
  approved: "ALLOW",
  broadcast: "PENDING",
  confirmed: "ALLOW",
  rejected: "REFUSE",
  expired: "REFUSE",
  failed: "REFUSE",
};

function statusWord(status: RequestStatus, t: (fr: string, en: string) => string): string {
  switch (status) {
    case "draft":
    case "pending":
      return t("en attente", "pending");
    case "approved":
      return t("2 clés · prête", "2 keys · ready");
    case "broadcast":
      return t("diffusée · attend un bloc", "broadcast · awaiting a block");
    case "confirmed":
      return t("confirmée", "confirmed");
    case "rejected":
      return t("refusée", "rejected");
    case "expired":
      return t("expirée", "expired");
    default:
      return t("échouée", "failed");
  }
}

function RequestCard({ role, item }: { role: OfficerRole; item: InboxItem }) {
  const { t, lang } = usePrefs();
  const demo = useDemo();
  const client = useQueryClient();
  const query = useRequest(item.requestId);
  const [busy, setBusy] = useState<string | false>(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const reasonId = useId();

  if (query.isPending) return <div className="h-36 animate-pulse rounded-[var(--radius-card)] bg-panel hairline motion-reduce:animate-none" />;
  if (query.isError && !query.data) {
    return (
      <div className="rounded-[var(--radius-card)] bg-panel p-1 hairline">
        <ErrorNote error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }
  const request = query.data as RequestView;
  const signers = request.approvals.map((approval) => approval.officer as Role);
  const signed = signers.includes(role);
  const open = request.status === "pending" || request.status === "draft";
  const read = item.message;
  const secret = demo.secrets[role];

  const refresh = async () => {
    demo.touch();
    await Promise.all([
      client.invalidateQueries({ queryKey: ["request", request.id] }),
      client.invalidateQueries({ queryKey: ["fund", demo.config.fundId] }),
      client.invalidateQueries({ queryKey: ["ledger", demo.config.fundId] }),
    ]);
  };

  const run = async (label: string, action: () => Promise<Outcome>) => {
    setBusy(label);
    setOutcome(null);
    let result: Outcome;
    try {
      result = await action();
      demo.log({ actor: role, state: result.state, title: result.title, detail: result.code ?? result.detail });
    } catch (error) {
      const code = errorCode(error);
      result =
        code === "UNKNOWN"
          ? { state: "UNKNOWN", title: t("Pas de réponse claire : rien n'est confirmé.", "No clear answer: nothing is confirmed."), code, detail: errorMessage(error) }
          : { state: "REFUSE", title: t("Refusé par le coordinateur", "Refused by the coordinator"), code, detail: errorMessage(error) };
      demo.log({ actor: role, state: result.state, title: result.title, detail: code });
    }
    await refresh();
    const settled = client.getQueryData<RequestView>(["request", request.id])?.status;
    setOutcome({ ...result, status: settled });
    setBusy(false);
  };

  const sign = (tamper: boolean) =>
    run(tamper ? t("Vérification…", "Checking…") : t("Signature…", "Signing…"), async () => {
      if (!read) throw new Error("no message");
      const decision = await signSpend({ config: demo.config, role, secret, read, requester: request.requester, tamper });
      if (decision.kind === "signed") return { state: "ALLOW", title: t("Signé : la demande lue est la transaction signée.", "Signed: the request read is the transaction signed.") };
      if (decision.kind === "refused")
        return {
          state: "REFUSE",
          title: tamper
            ? t("Serveur pris en faute : la PSBT ne correspond pas à la demande lue. Rien n'a été signé.", "Server caught: the PSBT does not match the request read. Nothing was signed.")
            : t("Refusé par la vérification locale.", "Refused by the local check."),
          code: decision.code,
        };
      return { state: "UNKNOWN", title: t("Ignoré", "Ignored"), detail: decision.reason };
    });

  const alone = () =>
    run(t("Envoi au nœud…", "Sending to the node…"), async () => {
      const answer = await spendAlone({ config: demo.config, role, secret, request });
      if (answer.kind === "refused")
        return { state: "REFUSE", title: t("bitcoind a refusé la transaction à une seule signature.", "bitcoind refused the single-signature transaction."), detail: answer.message };
      return { state: "UNKNOWN", title: t("Le nœud a accepté : à signaler.", "The node accepted: report this."), detail: answer.txid };
    });

  const send = () =>
    run(t("Diffusion…", "Broadcasting…"), async () => {
      const txid = await broadcast(request.id);
      return { state: "PENDING", title: t("Diffusée. Minez un bloc pour la confirmer.", "Broadcast. Mine a block to confirm it."), detail: txid };
    });

  const reject = () =>
    run(t("Refus…", "Rejecting…"), async () => {
      await rejectSpend({ config: demo.config, role, secret, requestId: request.id, requester: request.requester, reason: reason.trim() });
      setRejecting(false);
      return { state: "REFUSE", title: t("Vous avez refusé cette demande.", "You rejected this request.") };
    });

  const purpose = read?.purpose ?? request.purpose;
  const shake = outcome?.state === "REFUSE" ? "shake" : "";

  return (
    <article className={`arrive flex flex-col gap-3 rounded-[var(--radius-card)] bg-panel p-4 hairline ${shake}`} key={outcome?.title}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[22px] leading-tight tabular">{xof(request.amount_xof, lang)}</p>
          <p className="truncate font-mono text-[11px] text-text-3">
            {sats(request.amount_sats, lang)} sats · {t("figés", "locked")} @ {sats(request.rate_btc_eur.split(".")[0], lang)} €
          </p>
        </div>
        <Locks signers={signers} />
      </div>
      <p className="line-clamp-3 break-words text-[14px] leading-snug text-text" title={purpose}>
        {purpose}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
        <dt className="text-text-3">{t("Vers", "To")}</dt>
        <dd className="truncate font-mono text-text-2" title={request.recipient}>
          {request.recipient === demo.config.vendorAddress ? `${t("Fournisseur", "Vendor")} · ` : ""}
          {middle(request.recipient, 7)}
        </dd>
        <dt className="text-text-3">{t("Par", "By")}</dt>
        <dd className="text-text-2">{roleLabel(request.requester, t)}</dd>
        {open ? (
          <>
            <dt className="text-text-3">{t("Expire", "Expires")}</dt>
            <dd className="text-text-2" title={new Date(request.expires_at).toLocaleString(lang === "fr" ? "fr-SN" : "en-GB")}>
              {relative(request.expires_at, lang)}
            </dd>
          </>
        ) : null}
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        <StatePill state={statusState[request.status]}>{statusWord(request.status, t)}</StatePill>
        {signed && open ? <span className="text-[12px] text-text-3">{t("Votre clé est tournée.", "Your key is turned.")}</span> : null}
      </div>

      {outcome && (outcome.status === undefined || outcome.status === request.status) ? <OutcomeNote outcome={outcome} /> : null}

      {open && !signed && read && !rejecting ? (
        <div className="flex flex-col gap-2">
          <Button onClick={() => void sign(false)} busy={busy}>
            {t("Vérifier et signer", "Check and sign")}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" onClick={() => setRejecting(true)} disabled={Boolean(busy)}>
              {t("Refuser", "Reject")}
            </Button>
            <Button variant="danger" size="sm" onClick={() => void sign(true)} disabled={Boolean(busy)} title={t("Le serveur change le destinataire dans la PSBT", "The server swaps the recipient in the PSBT")}>
              {t("Serveur malveillant", "Malicious server")}
            </Button>
          </div>
        </div>
      ) : null}

      {open && rejecting ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (reason.trim().length > 0) void reject();
          }}
        >
          <label htmlFor={reasonId} className="text-[13px] font-medium text-text-2">
            {t("Motif du refus", "Reason")}
          </label>
          <textarea
            id={reasonId}
            value={reason}
            maxLength={140}
            rows={2}
            autoFocus
            onChange={(event) => setReason(event.target.value)}
            className="resize-none rounded-[var(--radius-ctl)] bg-raise p-3 text-base hairline focus:shadow-[inset_0_0_0_1.5px_var(--color-brand)] focus:outline-none sm:text-[15px]"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setRejecting(false)}>
              {t("Annuler", "Cancel")}
            </Button>
            <Button variant="danger" size="sm" type="submit" busy={busy} disabled={reason.trim().length === 0}>
              {t("Refuser", "Reject")}
            </Button>
          </div>
        </form>
      ) : null}

      {open && signed && signers.length < 2 ? (
        <Button variant="danger" size="sm" onClick={() => void alone()} busy={busy}>
          {t("Tenter de dépenser seul", "Try to spend alone")}
        </Button>
      ) : null}

      {request.status === "approved" ? (
        <Button onClick={() => void send()} busy={busy} arrow>
          {t("Diffuser la transaction", "Broadcast the transaction")}
        </Button>
      ) : null}

      {request.broadcast_txid ? (
        <p className="truncate font-mono text-[11px] text-text-3" title={request.broadcast_txid}>
          txid {middle(request.broadcast_txid, 10)}
        </p>
      ) : null}
    </article>
  );
}

function OutcomeNote({ outcome }: { outcome: Outcome }) {
  return (
    <div role="status" className="flex flex-col gap-1.5 rounded-[var(--radius-ctl)] bg-raise p-3 hairline">
      <StatePill state={outcome.state}>{outcome.state}</StatePill>
      <p className="text-[13px] leading-snug text-text">{outcome.title}</p>
      {outcome.code ? <Code>{outcome.code}</Code> : null}
      {outcome.detail ? <p className="break-all font-mono text-[11px] leading-snug text-text-2">{outcome.detail}</p> : null}
    </div>
  );
}
