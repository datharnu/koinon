import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DEMO_DUES_XOF, DEMO_MEMBERS, errorCode, mine, payDues } from "../lib/flows";
import { clock, xof } from "../lib/format";
import { usePrefs } from "../lib/prefs";
import { Button } from "../ui/button";
import { RoleDot, StateGlyph, type UiState } from "../ui/status";
import { useDemo } from "./context";
import { useFund } from "./hooks";
import { roleLabel } from "./PhoneApp";

const toneText: Record<UiState, string> = {
  PENDING: "text-pending",
  ALLOW: "text-allow",
  REFUSE: "text-refuse",
  UNKNOWN: "text-unknown",
};

export function Lab({ className = "" }: { className?: string }) {
  const { t, lang } = usePrefs();
  const demo = useDemo();
  const client = useQueryClient();
  const fund = useFund(demo.config.fundId);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => {
    demo.touch();
    void client.invalidateQueries({ queryKey: ["fund", demo.config.fundId] });
    void client.invalidateQueries({ queryKey: ["ledger", demo.config.fundId] });
    void client.invalidateQueries({ queryKey: ["request"] });
  };

  const doMine = async (blocks: number) => {
    setBusy(`mine-${blocks}`);
    try {
      const height = await mine(blocks);
      demo.log({ actor: "net", state: "ALLOW", title: t(blocks === 1 ? "1 bloc miné" : `${blocks} blocs minés`, blocks === 1 ? "1 block mined" : `${blocks} blocks mined`), detail: `height ${height}` });
    } catch (error) {
      demo.log({ actor: "net", state: "UNKNOWN", title: t("Minage impossible", "Mining failed"), detail: errorCode(error) });
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const doDues = async () => {
    setBusy("dues");
    const index = Math.floor(Math.random() * DEMO_MEMBERS.length);
    try {
      const txid = await payDues(demo.config, index, DEMO_DUES_XOF);
      demo.log({ actor: "net", state: "ALLOW", title: t(`${DEMO_MEMBERS[index]} cotise ${xof(DEMO_DUES_XOF, lang)}`, `${DEMO_MEMBERS[index]} pays ${xof(DEMO_DUES_XOF, lang)}`), detail: txid });
    } catch (error) {
      demo.log({ actor: "net", state: "UNKNOWN", title: t("Cotisation impossible", "Due failed"), detail: errorCode(error) });
    } finally {
      setBusy(null);
      refresh();
    }
  };

  return (
    <aside aria-label={t("Réseau de test", "Test network")} className={`flex min-h-0 flex-col gap-4 ${className}`}>
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-panel p-4 hairline">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold tracking-normal">{t("Réseau de test", "Test network")}</h2>
          <span className="font-mono text-[12px] text-text-3">
            {fund.data ? `${t("bloc", "block")} ${fund.data.chain_tip}` : "…"}
          </span>
        </div>
        <p className="text-[12.5px] leading-snug text-text-3">
          {t("Bitcoin Core en regtest. Les sats n'ont aucune valeur. Vous jouez le réseau.", "Bitcoin Core on regtest. Sats have no value. You play the network.")}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="secondary" onClick={() => void doMine(1)} busy={busy === "mine-1" ? t("Minage…", "Mining…") : false} disabled={busy !== null}>
            {t("Miner 1 bloc", "Mine 1 block")}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void doMine(demo.config.csvBlocks)} busy={busy === `mine-${demo.config.csvBlocks}` ? t("Minage…", "Mining…") : false} disabled={busy !== null}>
            {t(`Miner ${demo.config.csvBlocks}`, `Mine ${demo.config.csvBlocks}`)}
          </Button>
          <Button size="sm" variant="ghost" className="col-span-2" onClick={() => void doDues()} busy={busy === "dues" ? t("Paiement…", "Paying…") : false} disabled={busy !== null}>
            {t(`Un membre cotise ${xof(DEMO_DUES_XOF, lang)}`, `A member pays ${xof(DEMO_DUES_XOF, lang)}`)}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-[var(--radius-card)] bg-panel hairline">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[13px] font-semibold tracking-normal">{t("Ce que le réseau a répondu", "What the network answered")}</h2>
          <span className="font-mono text-[11px] text-text-3">{demo.entries.length}</span>
        </div>
        {demo.entries.length === 0 ? (
          <p className="p-4 text-[13px] leading-relaxed text-text-3">
            {t(
              "Rien encore. Ouvrez une dépense sur le téléphone du Trésorier, puis signez-la sur celui de la Secrétaire. Chaque réponse du nœud s'affiche ici, mot pour mot.",
              "Nothing yet. Open a spend on the Treasurer's phone, then sign it on the Secretary's. Every node answer shows here, word for word.",
            )}
          </p>
        ) : (
          <ol aria-live="polite" className="min-h-0 flex-1 overflow-y-auto">
            {demo.entries.map((entry) => (
              <li key={entry.id} className="arrive flex gap-3 border-t border-line px-4 py-3 first:border-t-0">
                <span className={`mt-0.5 ${toneText[entry.state]}`}>
                  <StateGlyph state={entry.state} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5 text-[11px] text-text-3">
                    {entry.actor === "net" ? <span className="font-mono">regtest</span> : (
                      <>
                        <RoleDot role={entry.actor} className="size-1.5" />
                        {roleLabel(entry.actor, t)}
                      </>
                    )}
                    <span aria-hidden>·</span>
                    <span className="font-mono">{clock(entry.at, lang)}</span>
                  </span>
                  <span className="text-[13px] leading-snug">{entry.title}</span>
                  {entry.detail ? <span className="break-all font-mono text-[11px] leading-snug text-text-2">{entry.detail}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}
