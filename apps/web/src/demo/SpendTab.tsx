import { satsForXof } from "@koinon/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { endpoints } from "../lib/api";
import { errorCode, openSpend, signSpend, type OfficerRole } from "../lib/flows";
import { sats, xof } from "../lib/format";
import { usePrefs } from "../lib/prefs";
import { Button } from "../ui/button";
import { Field } from "../ui/field";
import { Code } from "../ui/status";
import { useDemo } from "./context";

const PURPOSE_MAX = 140;

export function SpendTab({ role, onDone }: { role: OfficerRole; onDone: () => void }) {
  const { t, lang } = usePrefs();
  const demo = useDemo();
  const client = useQueryClient();
  const rate = useQuery({ queryKey: ["rate"], queryFn: endpoints.rate, refetchInterval: 15_000 });
  const [amount, setAmount] = useState("15000");
  const [recipient, setRecipient] = useState(demo.config.vendorAddress);
  const [purpose, setPurpose] = useState(t("Location de la salle pour l'assemblée générale", "Hall rental for the general assembly"));
  const [busy, setBusy] = useState<string | false>(false);
  const [failure, setFailure] = useState<string | null>(null);

  const digits = amount.replace(/\D/g, "");
  const value = digits === "" ? 0 : Number(digits);
  const amountError = value === 0 ? null : value < 100 ? t("100 F minimum.", "100 F minimum.") : value > 5_000_000 ? t("5 000 000 F maximum.", "5,000,000 F maximum.") : null;
  const preview = rate.data?.btc_eur && value > 0 && !amountError ? satsForXof(BigInt(value), rate.data.btc_eur) : null;
  const ready = value >= 100 && !amountError && recipient.trim().length > 0 && purpose.trim().length > 0 && rate.data?.btc_eur;

  const submit = async () => {
    setBusy(t("Ouverture…", "Opening…"));
    setFailure(null);
    try {
      const created = await openSpend({ config: demo.config, role, secret: demo.secrets[role], amountXof: value, recipient: recipient.trim(), purpose: purpose.trim() });
      setBusy(t("Signature…", "Signing…"));
      const decision = await signSpend({
        config: demo.config,
        role,
        secret: demo.secrets[role],
        requester: role,
        read: { request_id: created.id, amount_xof: value, amount_sats: created.amount_sats, recipient: recipient.trim(), purpose: purpose.trim(), expires_at: created.expires_at, path: "A" },
      });
      if (decision.kind !== "signed") {
        setFailure(decision.kind === "refused" ? decision.code : decision.reason);
        demo.log({ actor: role, state: "REFUSE", title: t("Votre propre vérification a refusé la PSBT", "Your own check refused the PSBT"), detail: decision.kind === "refused" ? decision.code : decision.reason });
        return;
      }
      demo.log({ actor: role, state: "PENDING", title: t(`Demande ouverte : ${xof(value, lang)}, 1 clé sur 2`, `Request opened: ${xof(value, lang)}, 1 key of 2`), detail: `${created.amount_sats} sats` });
      demo.touch();
      await client.invalidateQueries({ queryKey: ["inbox"] });
      onDone();
    } catch (error) {
      const code = errorCode(error);
      setFailure(code);
      demo.log({ actor: role, state: code === "UNKNOWN" ? "UNKNOWN" : "REFUSE", title: t("Demande refusée par le coordinateur", "Request refused by the coordinator"), detail: code });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) void submit();
      }}
    >
      <div className="px-1">
        <h3 className="text-[14px] font-semibold tracking-normal">{t("Nouvelle dépense", "New spend")}</h3>
        <p className="text-[12px] leading-snug text-text-3">
          {t("Votre clé signe en premier. Il en faut une deuxième.", "Your key signs first. A second one is required.")}
        </p>
      </div>
      <Field
        label={t("Montant", "Amount")}
        inputMode="numeric"
        autoComplete="off"
        value={digits === "" ? "" : xof(digits, lang).replace(" F", "")}
        onChange={(event) => setAmount(event.target.value)}
        suffix="F CFA"
        mono
        error={amountError}
        hint={
          preview !== null
            ? t(`≈ ${sats(preview, lang)} sats, figés à la création`, `≈ ${sats(preview, lang)} sats, locked at creation`)
            : rate.isError
              ? t("Taux indisponible : impossible de créer une dépense.", "Rate unavailable: no spend can be created.")
              : t("Le montant en sats est figé à la création.", "The sats amount is locked at creation.")
        }
      />
      <Field
        label={t("Destinataire", "Recipient")}
        value={recipient}
        onChange={(event) => setRecipient(event.target.value)}
        mono
        spellCheck={false}
        autoComplete="off"
        hint={recipient === demo.config.vendorAddress ? t("Adresse du fournisseur de démo (regtest).", "Demo vendor address (regtest).") : t("Une adresse bcrt1…", "A bcrt1… address")}
      />
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="spend-purpose" className="text-[13px] font-medium text-text-2">
            {t("Objet", "Purpose")}
          </label>
          <span className={`font-mono text-[11px] ${purpose.length >= PURPOSE_MAX ? "text-refuse" : "text-text-3"}`}>
            {purpose.length}/{PURPOSE_MAX}
          </span>
        </div>
        <textarea
          id="spend-purpose"
          value={purpose}
          maxLength={PURPOSE_MAX}
          rows={3}
          onChange={(event) => setPurpose(event.target.value)}
          className="resize-none rounded-[var(--radius-ctl)] bg-raise p-3 text-base leading-snug hairline focus:shadow-[inset_0_0_0_1.5px_var(--color-brand)] focus:outline-none sm:text-[15px]"
        />
      </div>
      {failure ? (
        <div role="alert" className="flex flex-col items-start gap-1.5 rounded-[var(--radius-ctl)] bg-[color-mix(in_srgb,var(--color-refuse)_8%,transparent)] p-3">
          <Code>{failure}</Code>
          <p className="text-[13px] text-text-2">
            {failure === "INSUFFICIENT_FUNDS"
              ? t("Le fonds ne couvre pas ce montant et les frais.", "The fund does not cover this amount and the fee.")
              : failure === "VALIDATION"
                ? t("Un champ n'est pas accepté (adresse regtest ?).", "A field was not accepted (regtest address?).")
                : t("Rien n'a été signé.", "Nothing was signed.")}
          </p>
        </div>
      ) : null}
      <Button type="submit" size="lg" busy={busy} disabled={!ready} arrow>
        {t("Ouvrir et signer", "Open and sign")}
      </Button>
    </form>
  );
}
