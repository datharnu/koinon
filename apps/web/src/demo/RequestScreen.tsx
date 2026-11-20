import { useId, useState } from "react";
import type { RequestView } from "../lib/api";
import { broadcast, errorCode, errorMessage, rejectSpend, signSpend, spendAlone, type OfficerRole } from "../lib/flows";
import { clock, middle, relative, sats, xof } from "../lib/format";
import { memberLink } from "../lib/link";
import { PEOPLE, roleTitle } from "../lib/people";
import { usePrefs } from "../lib/prefs";
import { Avatar } from "../ui/avatar";
import { Button, ButtonLink } from "../ui/button";
import { IconAlert, IconArrowRight, IconCheck, IconClock, IconCopy, IconCube, IconEye, IconShield, IconStore } from "../ui/icons";
import { Sheet } from "../ui/sheet";
import { ErrorState, Skeleton } from "../ui/states";
import { useToast } from "../ui/toast";
import { useDemo } from "./context";
import { useOfficerRequests, useRefresh, useRequest } from "./hooks";
import { nodeVerdict, useNetwork, VerdictView, type Verdict } from "./Network";
import { StatusChip } from "./RequestStatus";
import { useStage } from "./stage";
import { Group, Note, Row, ScreenHeader, SectionTitle, StickyFooter, useNav } from "./ui";

interface Failure {
  title: string;
  body: string;
  code: string;
}

export function RequestScreen({ role, id }: { role: OfficerRole; id: string }) {
  const { t } = usePrefs();
  const nav = useNav();
  const query = useRequest(id);
  return (
    <>
      <ScreenHeader title={t("Demande", "Request")} onBack={nav.back} />
      {query.isPending ? (
        <div className="flex flex-col items-center gap-3 px-5 pt-6">
          <Skeleton className="size-14 rounded-full" />
          <Skeleton className="h-10 w-48 rounded-xl" />
          <Skeleton className="h-4 w-40 rounded-md" />
          <Skeleton className="mt-4 h-40 w-full rounded-[22px]" />
        </div>
      ) : query.isError && !query.data ? (
        <div className="px-4 pt-4">
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </div>
      ) : (
        <Detail role={role} request={query.data} />
      )}
    </>
  );
}

function Detail({ role, request }: { role: OfficerRole; request: RequestView }) {
  const { t, lang } = usePrefs();
  const demo = useDemo();
  const nav = useNav();
  const toast = useToast();
  const refresh = useRefresh();
  const { entries } = useOfficerRequests(role);
  const stage = useStage();
  const network = useNetwork();
  const [busy, setBusy] = useState<string | false>(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [solo, setSolo] = useState<Verdict | null>(null);
  const [soloBusy, setSoloBusy] = useState(false);

  const item = entries.find((entry) => entry.item.requestId === request.id)?.item;
  const read = item?.message;
  const person = PEOPLE[request.requester];
  const signedBy = new Map(request.approvals.map((approval) => [approval.officer, approval.signed_at]));
  const signed = signedBy.has(role);
  const open = request.status === "pending" || request.status === "draft";
  const purpose = read?.purpose ?? request.purpose;
  const isVendor = request.recipient === demo.config.vendorAddress;

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    setFailure(null);
    try {
      await action();
    } catch (error) {
      const code = errorCode(error);
      setFailure(
        code === "UNKNOWN"
          ? { title: t("Pas de réponse claire", "No clear answer"), body: t("Rien n'est confirmé. Vérifiez la connexion et réessayez.", "Nothing is confirmed. Check the connection and retry."), code: errorMessage(error) }
          : { title: t("Refusé par le serveur", "Refused by the server"), body: t("Rien n'a été signé ni envoyé.", "Nothing was signed or sent."), code },
      );
    } finally {
      await refresh(request.id);
      setBusy(false);
    }
  };

  const approve = () =>
    run(t("Vérification…", "Checking…"), async () => {
      if (!read) throw new Error("no message");
      const secret = demo.secrets[role];
      if (!secret) throw new Error("NO_KEY");
      const decision = await signSpend({ config: demo.config, role, secret, read, requester: request.requester });
      if (decision.kind === "signed") {
        toast({
          tone: "good",
          title: decision.status === "approved" ? t("2 signatures sur 2", "2 of 2 signatures") : t("Signé", "Signed"),
          body: t("La transaction correspond octet par octet à la demande lue.", "The transaction matches the request you read, byte for byte."),
        });
        return;
      }
      if (decision.kind === "refused") {
        setFailure({ title: t("Signature refusée par votre téléphone", "Your phone refused to sign"), body: t("La transaction ne correspond pas à la demande lue.", "The transaction does not match the request you read."), code: decision.code });
        return;
      }
      setFailure({ title: t("Demande ignorée", "Request ignored"), body: decision.reason, code: "IGNORED" });
    });

  const send = () =>
    run(t("Envoi…", "Sending…"), async () => {
      const txid = await broadcast(request.id);
      toast({ tone: "good", title: t("Transaction envoyée", "Transaction sent"), body: t("Elle sera confirmée au prochain bloc.", "It confirms with the next block."), detail: txid });
    });

  const openReject = () =>
    nav.sheet(
      <RejectSheet
        onClose={() => nav.sheet(null)}
        onConfirm={async (reason) => {
          nav.sheet(null);
          await run(t("Refus…", "Rejecting…"), async () => {
            const secret = demo.secrets[role];
            if (!secret) throw new Error("NO_KEY");
            await rejectSpend({ config: demo.config, role, secret, requestId: request.id, requester: request.requester, reason });
            toast({ tone: "info", title: t("Demande refusée", "Request rejected"), body: t(`${person.first} est prévenu par message chiffré.`, `${person.first} is told by encrypted message.`) });
          });
        }}
      />,
    );

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text).then(() => toast({ tone: "info", title: t("Copié", "Copied") }));
  };

  /** The same request, sent to Bitcoin Core with this officer's signature only. */
  const trySolo = async () => {
    setSoloBusy(true);
    setSolo(null);
    try {
      const secret = demo.secrets[role];
      if (!secret) throw new Error("NO_KEY");
      const answer = await spendAlone({ config: demo.config, role, secret, request });
      setSolo({
        ...nodeVerdict(
          answer,
          t("Bitcoin Core refuse une transaction avec une seule signature.", "Bitcoin Core refuses a transaction with one signature."),
          t("Bitcoin Core a accepté la transaction.", "Bitcoin Core accepted the transaction."),
        ),
        about: answer.kind === "refused" ? t("Cette demande est intacte : 1 approbation sur 2, aucun argent n'a bougé.", "This request is unchanged: 1 of 2 approvals, no money has moved.") : undefined,
      });
    } catch (error) {
      setSolo({ kind: "error", title: t("Pas de réponse claire", "No clear answer"), detail: `${errorCode(error)} · ${errorMessage(error)}` });
    } finally {
      setSoloBusy(false);
      await refresh(request.id);
    }
  };

  const partner: OfficerRole = role === "O1" ? "O2" : "O1";
  const waitingOnOne = open && signed && signedBy.size === 1;
  const canHandOff = Boolean(stage) && waitingOnOne && !signedBy.has(partner);
  const next = waitingOnOne ? (
    <section aria-label={t("Étape suivante", "Next step")} className="rounded-[22px] bg-card p-4">
      <h3 className="text-[13px] font-semibold text-ink-2">{t("Étape suivante", "Next step")}</h3>
      {solo ? (
        <VerdictView verdict={solo} />
      ) : (
        <p className="mt-1 text-[13.5px] leading-snug text-ink-2">
          {t(
            `D'abord, essayez de payer avec la seule signature de ${PEOPLE[role].first}. Bitcoin Core doit refuser.`,
            `First, try to pay with only ${PEOPLE[role].first}'s signature. Bitcoin Core should refuse.`,
          )}
        </p>
      )}
      <div className="mt-3 flex flex-col gap-2">
        {solo && canHandOff && stage ? (
          <Button block onClick={() => stage.handTo(partner, request.id)} icon={<IconArrowRight size={17} />}>
            {stage.together ? t(`Approuver chez ${PEOPLE[partner].first}`, `Approve on ${PEOPLE[partner].first}'s phone`) : t(`Passer à ${PEOPLE[partner].first} pour approuver`, `Switch to ${PEOPLE[partner].first} to approve`)}
          </Button>
        ) : null}
        <Button
          block
          variant={solo ? "secondary" : "dark"}
          className={solo ? "bg-surface hover:bg-card-2" : ""}
          onClick={() => void trySolo()}
          busy={soloBusy ? t("Envoi à Bitcoin Core…", "Sending to Bitcoin Core…") : false}
        >
          {solo ? t("Réessayer avec une seule signature", "Try one signature again") : t(`Envoyer avec la seule signature de ${PEOPLE[role].first}`, `Send with only ${PEOPLE[role].first}'s signature`)}
        </Button>
        {!solo && canHandOff && stage ? (
          <Button block variant="ghost" onClick={() => stage.handTo(partner, request.id)}>
            {t(`Passer directement à ${PEOPLE[partner].first}`, `Skip to ${PEOPLE[partner].first}`)}
          </Button>
        ) : null}
      </div>
    </section>
  ) : null;

  const settle =
    request.status === "broadcast" ? (
      <Button block variant="dark" icon={<IconCube size={17} />} onClick={() => void network.mineBlocks(1)} busy={network.busy === "mine" ? t("Minage…", "Mining…") : false} disabled={network.busy !== null}>
        {t("Miner un bloc pour confirmer (réseau de test)", "Mine a block to confirm (test network)")}
      </Button>
    ) : request.status === "confirmed" && request.broadcast_txid ? (
      <ButtonLink external href={memberLink(demo.config, window.location.origin, request.broadcast_txid)} variant="soft" className="w-full" icon={<IconEye size={17} />}>
        {t("Ouvrir le reçu du membre", "Open the member receipt")}
      </ButtonLink>
    ) : null;

  const footer = (() => {
    if (open && !signed && read) {
      return (
        <StickyFooter
          note={
            <p className="flex items-center justify-center gap-1.5 text-[12.5px] text-ink-2">
              <IconShield size={14} className="text-brand" />
              {t("Votre téléphone revérifie la transaction avant de signer.", "Your phone re-checks the transaction before signing.")}
            </p>
          }
        >
          <div className="flex flex-col gap-1">
            <Button size="lg" block onClick={() => void approve()} busy={busy}>
              {t("Approuver", "Approve")}
            </Button>
            <Button variant="ghost" block onClick={openReject} disabled={Boolean(busy)}>
              {t("Refuser", "Reject")}
            </Button>
          </div>
        </StickyFooter>
      );
    }
    if (request.status === "approved") {
      return (
        <StickyFooter>
          <Button size="lg" block onClick={() => void send()} busy={busy}>
            {t("Envoyer la transaction", "Send the transaction")}
          </Button>
        </StickyFooter>
      );
    }
    return null;
  })();

  const count = Math.min(signedBy.size, 2);
  const statusNote = (() => {
    if (open && signed) {
      const waiting = (["O1", "O2", "O3"] as const).filter((officer) => !signedBy.has(officer)).map((officer) => PEOPLE[officer].first);
      return (
        <Note icon={<IconClock size={16} />}>
          <strong className="font-semibold text-ink">{t(`${count} approbation sur 2. Aucun argent n'a bougé.`, `${count} of 2 approvals. No money has moved.`)}</strong>{" "}
          {t(`${waiting.join(" ou ")} doit encore signer.`, `${waiting.join(" or ")} still has to sign.`)}
        </Note>
      );
    }
    if (open && !read && !signed) return <Note icon={<IconClock size={16} />}>{t("Le message chiffré n'est pas encore arrivé sur ce téléphone.", "The encrypted message has not reached this phone yet.")}</Note>;
    if (open && read && !signed) {
      return (
        <Note icon={<IconShield size={16} />}>
          <strong className="font-semibold text-ink">{t(`${count} approbation sur 2. Aucun argent n'a bougé.`, `${count} of 2 approvals. No money has moved.`)}</strong>{" "}
          {count === 1
            ? t("La vôtre serait la deuxième. Relisez le montant, le destinataire et l'objet.", "Yours would be the second. Check the amount, the recipient and the purpose.")
            : t("Relisez le montant, le destinataire et l'objet.", "Check the amount, the recipient and the purpose.")}
        </Note>
      );
    }
    if (request.status === "approved") {
      return (
        <Note icon={<IconCheck size={16} />}>
          <strong className="font-semibold text-ink">{t("2 approbations sur 2.", "2 of 2 approvals.")}</strong>{" "}
          {t("Aucun argent n'a encore bougé : envoyez la transaction pour payer.", "No money has moved yet: send the transaction to pay.")}
        </Note>
      );
    }
    if (request.status === "broadcast") return <Note tone="warn" icon={<IconClock size={16} />}>{t("Envoyée. En attente d'un bloc, pas encore confirmée.", "Sent. Waiting for a block, not confirmed yet.")}</Note>;
    if (request.status === "confirmed") return <Note tone="good" icon={<IconCheck size={16} />}>{t("Payée. La transaction est dans un bloc.", "Paid. The transaction is in a block.")}</Note>;
    if (request.status === "rejected") return <Note tone="bad" icon={<IconAlert size={16} />}>{t("Refusée par un membre du bureau. Rien n'est parti.", "Rejected by an officer. Nothing was sent.")}</Note>;
    if (request.status === "expired") return <Note icon={<IconClock size={16} />}>{t("Expirée sans deuxième signature. Rien n'est parti.", "Expired without a second signature. Nothing was sent.")}</Note>;
    if (request.status === "failed") return <Note tone="bad" icon={<IconAlert size={16} />}>{t("Le réseau a refusé la transaction.", "The network refused the transaction.")}</Note>;
    return null;
  })();

  return (
    <>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="fade-up flex flex-col items-center px-6 pb-6 pt-2 text-center">
          <Avatar name={person.name} tone={person.tone} size={52} />
          <p className="mt-3 text-[14px] text-ink-2">
            {item?.mine ? t("Vous demandez", "You are requesting") : t(`${person.first} demande`, `${person.first} is requesting`)}
          </p>
          <p className="tabular mt-1 text-[40px] font-bold leading-none tracking-[-0.03em]">{xof(request.amount_xof, lang)}</p>
          <p className="tabular mt-2 text-[13px] text-ink-3">
            {sats(request.amount_sats, lang)} sats · {t("taux figé", "rate locked")} {sats(request.rate_btc_eur.split(".")[0], lang)} €
          </p>
          <p className="mt-3 max-w-full break-words text-[15px] leading-snug">« {purpose} »</p>
          <div className="mt-3">
            <StatusChip request={request} role={role} />
          </div>
        </div>

        <div className="flex flex-col gap-5 px-4 pb-5">
          {failure ? (
            <div role="alert" className="shake flex items-start gap-3 rounded-2xl bg-bad-soft p-3.5 text-bad">
              <IconAlert size={18} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold">{failure.title}</p>
                <p className="text-[13px] leading-snug opacity-90">{failure.body}</p>
                <p className="mt-1 break-all font-mono text-[11px] opacity-80">{failure.code}</p>
              </div>
            </div>
          ) : null}
          {statusNote || settle ? (
            <div className="flex flex-col gap-2">
              {statusNote}
              {settle}
            </div>
          ) : null}
          {next}

          <Group>
            <Row
              icon={<IconStore size={18} className="text-ink-2" />}
              title={isVendor ? t("Fournisseur de démo", "Demo vendor") : t("Destinataire", "Recipient")}
              subtitle={<span className="font-mono">{middle(request.recipient, 9)}</span>}
              right={
                <button type="button" onClick={() => copy(request.recipient)} aria-label={t("Copier l'adresse", "Copy the address")} className="press grid size-9 place-items-center rounded-full text-ink-3 hover:bg-surface hover:text-ink">
                  <IconCopy size={16} />
                </button>
              }
            />
            <Row title={t("Demandé par", "Requested by")} right={<span className="text-[14px] text-ink-2">{person.name}</span>} />
            {open ? (
              <Row
                title={t("Expire", "Expires")}
                right={
                  <span className="text-[14px] text-ink-2" title={new Date(request.expires_at).toLocaleString(lang === "fr" ? "fr-SN" : "en-GB")}>
                    {relative(request.expires_at, lang)}
                  </span>
                }
              />
            ) : null}
            {request.fee_sats ? <Row title={t("Frais réseau", "Network fee")} right={<span className="tabular text-[14px] text-ink-2">{sats(request.fee_sats, lang)} sats</span>} /> : null}
            {request.broadcast_txid ? (
              <Row
                title={t("Transaction", "Transaction")}
                subtitle={<span className="font-mono">{middle(request.broadcast_txid, 10)}</span>}
                right={
                  <button type="button" onClick={() => copy(request.broadcast_txid ?? "")} aria-label={t("Copier le txid", "Copy the txid")} className="press grid size-9 place-items-center rounded-full text-ink-3 hover:bg-surface hover:text-ink">
                    <IconCopy size={16} />
                  </button>
                }
              />
            ) : null}
          </Group>

          <section>
            <SectionTitle action={<span className="text-[12.5px] font-semibold text-ink-3">{t(`${Math.min(signedBy.size, 2)} sur 2 requises`, `${Math.min(signedBy.size, 2)} of 2 required`)}</span>}>
              {t("Signatures", "Signatures")}
            </SectionTitle>
            <Group>
              {(["O1", "O2", "O3"] as const).map((officer) => {
                const at = signedBy.get(officer);
                const who = PEOPLE[officer];
                return (
                  <Row
                    key={officer}
                    icon={<Avatar name={who.name} tone={who.tone} size={36} />}
                    title={officer === role ? `${who.name} (${t("vous", "you")})` : who.name}
                    subtitle={roleTitle(officer, t)}
                    right={
                      at ? (
                        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-good">
                          <span className="grid size-5 place-items-center rounded-full bg-good text-white">
                            <IconCheck size={12} />
                          </span>
                          {clock(at, lang)}
                        </span>
                      ) : (
                        <span className="text-[13px] text-ink-3">{open ? t("En attente", "Waiting") : "—"}</span>
                      )
                    }
                  />
                );
              })}
            </Group>
          </section>
        </div>
      </div>
      {footer}
    </>
  );
}

function RejectSheet({ onClose, onConfirm }: { onClose: () => void; onConfirm: (reason: string) => void }) {
  const { t } = usePrefs();
  const [reason, setReason] = useState("");
  const id = useId();
  const presets = [t("Montant trop élevé", "Amount too high"), t("Pas voté en assemblée", "Not voted in assembly"), t("Mauvais fournisseur", "Wrong vendor")];
  return (
    <Sheet
      open
      contained
      onClose={onClose}
      title={t("Refuser la demande", "Reject the request")}
      footer={
        <Button variant="danger" size="lg" block disabled={reason.trim().length === 0} onClick={() => onConfirm(reason.trim())}>
          {t("Refuser", "Reject")}
        </Button>
      }
    >
      <div className="flex flex-col gap-3 pb-1">
        <p className="text-[13.5px] text-ink-2">{t("Le motif est envoyé chiffré au demandeur.", "The reason is sent encrypted to the requester.")}</p>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setReason(preset)}
              className={`press h-8 rounded-full px-3 text-[13px] font-semibold transition-colors ${reason === preset ? "bg-ink text-surface" : "bg-card text-ink hover:bg-card-2"}`}
            >
              {preset}
            </button>
          ))}
        </div>
        <label htmlFor={id} className="sr-only">
          {t("Motif", "Reason")}
        </label>
        <textarea
          id={id}
          value={reason}
          maxLength={140}
          rows={3}
          placeholder={t("Ou écrivez un motif…", "Or write a reason…")}
          onChange={(event) => setReason(event.target.value)}
          className="resize-none rounded-2xl bg-card p-3.5 text-base leading-snug placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand sm:text-[15px]"
        />
      </div>
    </Sheet>
  );
}
