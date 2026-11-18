import { satsForXof } from "@koinon/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { endpoints } from "../lib/api";
import { errorCode, openSpend, signSpend, type OfficerRole } from "../lib/flows";
import { middle, sats, xof } from "../lib/format";
import { PEOPLE } from "../lib/people";
import { usePrefs } from "../lib/prefs";
import { Button } from "../ui/button";
import { IconAlert, IconCheck, IconStore, IconUsers } from "../ui/icons";
import { Sheet } from "../ui/sheet";
import { useToast } from "../ui/toast";
import { useDemo } from "./context";
import { useFund } from "./hooks";
import { Group, IconBubble, Row, ScreenHeader, StickyFooter, useNav } from "./ui";

const PURPOSE_MAX = 140;
const MIN_XOF = 100;
const MAX_XOF = 5_000_000;
const PRESETS = [5_000, 15_000, 25_000];

export function SpendScreen({ role }: { role: OfficerRole }) {
  const { t, lang } = usePrefs();
  const demo = useDemo();
  const nav = useNav();
  const toast = useToast();
  const client = useQueryClient();
  const fund = useFund(demo.config.fundId);
  const rate = useQuery({ queryKey: ["rate"], queryFn: endpoints.rate, refetchInterval: 15_000 });
  const [digits, setDigits] = useState("15000");
  const [recipient, setRecipient] = useState(demo.config.vendorAddress);
  const [editing, setEditing] = useState(false);
  const [purpose, setPurpose] = useState(t("Location de la salle pour l'assemblée générale", "Hall rental for the general assembly"));
  const [busy, setBusy] = useState<string | false>(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const purposeId = useId();
  const recipientId = useId();
  const amountId = useId();
  const formId = useId();

  const value = digits === "" ? 0 : Number(digits);
  const shown = digits === "" ? "" : xof(digits, lang).replace(" F", "");
  const balance = fund.data?.balance_xof ? Number(fund.data.balance_xof) : null;
  const amountError =
    value === 0
      ? null
      : value < MIN_XOF
        ? t("100 F minimum", "100 F minimum")
        : value > MAX_XOF
          ? t("5 000 000 F maximum", "5,000,000 F maximum")
          : balance !== null && value > balance
            ? t("Plus que le solde de la caisse", "More than the fund holds")
            : null;
  const preview = rate.data?.btc_eur && value > 0 && !amountError ? satsForXof(BigInt(value), rate.data.btc_eur) : null;
  const ready = value >= MIN_XOF && !amountError && recipient.trim().length > 0 && purpose.trim().length > 0 && Boolean(rate.data?.btc_eur);
  const cosigners = (["O1", "O2", "O3"] as const).filter((officer) => officer !== role).map((officer) => PEOPLE[officer].first);
  const isVendor = recipient === demo.config.vendorAddress;

  const submit = async () => {
    setBusy(t("Ouverture…", "Opening…"));
    setFailure(null);
    try {
      const secret = demo.secrets[role];
      if (!secret) throw new Error("NO_KEY");
      const created = await openSpend({ config: demo.config, role, secret, amountXof: value, recipient: recipient.trim(), purpose: purpose.trim() });
      setBusy(t("Signature…", "Signing…"));
      const decision = await signSpend({
        config: demo.config,
        role,
        secret,
        requester: role,
        read: { request_id: created.id, amount_xof: value, amount_sats: created.amount_sats, recipient: recipient.trim(), purpose: purpose.trim(), expires_at: created.expires_at, path: "A" },
      });
      if (decision.kind !== "signed") {
        setFailure(decision.kind === "refused" ? decision.code : decision.reason);
        setReviewing(false);
        return;
      }
      demo.touch();
      await client.invalidateQueries({ queryKey: ["inbox"] });
      setReviewing(false);
      setSent(created.id);
      toast({ tone: "good", title: t("Demande envoyée", "Request sent"), body: t(`${cosigners.join(" et ")} l'ont reçue.`, `${cosigners.join(" and ")} received it.`) });
    } catch (error) {
      setFailure(errorCode(error));
      setReviewing(false);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <>
        <ScreenHeader title="" onBack={nav.back} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <span className="pop grid size-20 place-items-center rounded-full bg-good text-white shadow-[0_12px_30px_-10px_var(--color-good)]">
            <IconCheck size={40} />
          </span>
          <h2 className="text-[24px] font-bold">{t("Demande envoyée", "Request sent")}</h2>
          <p className="text-[15px] leading-snug text-ink-2">
            {t(
              `${xof(value, lang)} pour « ${purpose.trim()} ». Votre signature est posée ; ${cosigners.join(" ou ")} doit signer pour que l'argent parte.`,
              `${xof(value, lang)} for "${purpose.trim()}". Your signature is in; ${cosigners.join(" or ")} must sign before any money moves.`,
            )}
          </p>
        </div>
        <StickyFooter>
          <div className="flex flex-col gap-1">
            <Button
              size="lg"
              block
              onClick={() => {
                nav.back();
                nav.push({ name: "request", id: sent });
              }}
            >
              {t("Voir la demande", "View the request")}
            </Button>
            <Button variant="ghost" block onClick={nav.back}>
              {t("Terminé", "Done")}
            </Button>
          </div>
        </StickyFooter>
      </>
    );
  }

  const rows = [
    { label: t("Montant", "Amount"), value: xof(value, lang) },
    { label: t("En bitcoin", "In bitcoin"), value: preview !== null ? `${sats(preview, lang)} sats` : "—" },
    { label: t("À", "To"), value: isVendor ? t("Fournisseur de démo", "Demo vendor") : middle(recipient, 8) },
    { label: t("Objet", "Purpose"), value: purpose.trim() },
    { label: t("Signatures", "Signatures"), value: t("2 sur 3 membres du bureau", "2 of 3 officers") },
  ];

  return (
    <>
      <Sheet
        open={reviewing}
        contained
        onClose={() => setReviewing(false)}
        title={t("Vérifiez la dépense", "Review the spend")}
        footer={
          <Button size="lg" block onClick={() => void submit()} busy={busy}>
            {t("Signer et envoyer", "Sign and send")}
          </Button>
        }
      >
        <dl className="flex flex-col divide-y divide-line rounded-[20px] bg-card px-4">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-4 py-3">
              <dt className="shrink-0 text-[14px] text-ink-2">{row.label}</dt>
              <dd className="min-w-0 break-words text-right text-[14px] font-semibold">{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[12.5px] leading-snug text-ink-3">
          {t("Le montant en sats est figé maintenant. La demande part chiffrée par Nostr.", "The sats amount is locked now. The request goes out encrypted over Nostr.")}
        </p>
      </Sheet>
      <ScreenHeader title={t("Nouvelle dépense", "New spend")} onBack={nav.back} />
      <form
        id={formId}
        className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) setReviewing(true);
        }}
      >
        <div className={`rounded-[24px] bg-card p-4 ${amountError ? "ring-2 ring-bad/40" : ""}`}>
          <div className="flex items-center justify-between text-[13px]">
            <label htmlFor={amountId} className="font-semibold text-ink-2">
              {t("Vous envoyez", "You send")}
            </label>
            <span className="text-ink-3">
              {t("Disponible", "Available")} <span className="tabular font-semibold text-ink-2">{fund.data ? xof(fund.data.balance_xof, lang) : "…"}</span>
            </span>
          </div>
          <div className="mt-1 flex cursor-text items-baseline gap-1.5" onClick={() => document.getElementById(amountId)?.focus()}>
            <input
              id={amountId}
              inputMode="numeric"
              autoComplete="off"
              value={shown}
              placeholder="0"
              onChange={(event) => setDigits(event.target.value.replace(/\D/g, "").slice(0, 7))}
              style={{ width: `${Math.max(shown.length, 1) * 0.62 + 0.2}em` }}
              className="tabular min-w-0 max-w-full bg-transparent text-[40px] font-bold leading-tight tracking-[-0.03em] placeholder:text-ink-3 focus:outline-none"
            />
            <span className="text-[22px] font-bold text-ink-3">F</span>
          </div>
          <p className={`tabular text-[13px] ${amountError ? "font-semibold text-bad" : "text-ink-3"}`}>
            {amountError ?? (preview !== null ? t(`≈ ${sats(preview, lang)} sats · taux figé à l'envoi`, `≈ ${sats(preview, lang)} sats · rate locked on send`) : rate.isError ? t("Taux indisponible", "Rate unavailable") : "≈ — sats")}
          </p>
          <div className="mt-3 flex gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDigits(String(preset))}
                className={`press tabular h-8 rounded-full px-3 text-[13px] font-semibold transition-colors ${value === preset ? "bg-ink text-surface" : "bg-surface text-ink hover:bg-card-2"}`}
              >
                {xof(preset, lang)}
              </button>
            ))}
          </div>
        </div>

        <Group>
          {editing ? (
            <div className="flex flex-col gap-1.5 p-4">
              <label htmlFor={recipientId} className="text-[13px] font-semibold text-ink-2">
                {t("Adresse bitcoin (regtest)", "Bitcoin address (regtest)")}
              </label>
              <input
                id={recipientId}
                value={recipient}
                autoFocus
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => setRecipient(event.target.value.trim())}
                className="h-11 rounded-xl bg-surface px-3 font-mono text-[13px] focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <button type="button" onClick={() => { setRecipient(demo.config.vendorAddress); setEditing(false); }} className="self-start text-[13px] font-semibold text-brand">
                {t("Revenir au fournisseur de démo", "Back to the demo vendor")}
              </button>
            </div>
          ) : (
            <Row
              icon={
                <IconBubble tone="brand">
                  <IconStore size={18} />
                </IconBubble>
              }
              title={isVendor ? t("Fournisseur de démo", "Demo vendor") : t("Autre adresse", "Other address")}
              subtitle={<span className="font-mono">{middle(recipient, 9)}</span>}
              right={
                <button type="button" onClick={() => setEditing(true)} className="press h-8 rounded-full bg-surface px-3 text-[13px] font-semibold">
                  {t("Modifier", "Change")}
                </button>
              }
            />
          )}
        </Group>

        <div className="rounded-[22px] bg-card p-4">
          <div className="flex items-baseline justify-between">
            <label htmlFor={purposeId} className="text-[13px] font-semibold text-ink-2">
              {t("Objet", "Purpose")}
            </label>
            <span className={`tabular text-[12px] ${purpose.length >= PURPOSE_MAX ? "text-bad" : "text-ink-3"}`}>
              {purpose.length}/{PURPOSE_MAX}
            </span>
          </div>
          <textarea
            id={purposeId}
            value={purpose}
            maxLength={PURPOSE_MAX}
            rows={2}
            placeholder={t("À quoi sert cet argent ?", "What is this money for?")}
            onChange={(event) => setPurpose(event.target.value)}
            className="mt-1 w-full resize-none bg-transparent text-base leading-snug placeholder:text-ink-3 focus:outline-none sm:text-[15px]"
          />
        </div>

        {failure ? (
          <div role="alert" className="shake flex items-start gap-3 rounded-2xl bg-bad-soft p-3.5 text-bad">
            <IconAlert size={18} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold">
                {failure === "INSUFFICIENT_FUNDS"
                  ? t("La caisse ne couvre pas ce montant et les frais.", "The fund does not cover this amount and the fee.")
                  : failure === "VALIDATION"
                    ? t("Adresse ou montant refusé.", "Address or amount refused.")
                    : t("La demande n'est pas partie.", "The request did not go out.")}
              </p>
              <p className="font-mono text-[11px] opacity-80">{failure}</p>
            </div>
          </div>
        ) : null}
      </form>
      <StickyFooter
        note={
          <p className="flex items-center justify-center gap-1.5 text-[12.5px] text-ink-2">
            <IconUsers size={14} className="text-brand" />
            {t(`${cosigners.join(" ou ")} devra aussi signer.`, `${cosigners.join(" or ")} must also sign.`)}
          </p>
        }
      >
        <Button type="submit" form={formId} size="lg" block disabled={!ready} busy={busy}>
          {t("Vérifier", "Review")}
        </Button>
      </StickyFooter>
    </>
  );
}
