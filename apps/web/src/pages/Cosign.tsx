import "../polyfills";
import { decryptKey } from "@koinon/core";
import { useEffect, useState } from "react";
import { DemoProvider } from "../demo/context";
import { PhoneApp } from "../demo/PhoneApp";
import { decodeCosign, type CosignPayload } from "../lib/cosign";
import { useMedia } from "../lib/media";
import { PEOPLE } from "../lib/people";
import { usePrefs } from "../lib/prefs";
import type { Secret } from "../lib/vault";
import { ButtonLink } from "../ui/button";
import { Logo } from "../ui/icons";
import { PhoneFrame } from "../ui/phone";
import { PinPad } from "../ui/pinpad";
import { EmptyState } from "../ui/states";
import { SiteNav } from "../ui/site";

const STORAGE = "koinon.cosign.v1";

export default function Cosign() {
  const framed = useMedia("(min-width: 640px)");
  const [payload] = useState<CosignPayload | null>(() => readStored());
  const body = <CosignApp payload={payload} />;
  if (!framed) return <div className="relative flex h-dvh flex-col bg-surface">{body}</div>;
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteNav links={false} />
      <main className="flex flex-1 items-center justify-center px-4 pb-10 pt-24">
        <PhoneFrame>{body}</PhoneFrame>
      </main>
    </div>
  );
}

function readStored(): CosignPayload | null {
  const hash = window.location.hash.replace(/^#/, "");
  if (hash) {
    const decoded = decodeCosign(hash);
    if (decoded) sessionStorage.setItem(STORAGE, JSON.stringify(decoded));
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    if (decoded) return decoded;
  }
  try {
    const raw = sessionStorage.getItem(STORAGE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CosignPayload;
    if (parsed?.v !== 1 || parsed.config?.v !== 1 || parsed.key?.v !== 1 || parsed.key.kdf !== "PBKDF2-SHA256") return null;
    return parsed;
  } catch {
    return null;
  }
}

function CosignApp({ payload }: { payload: CosignPayload | null }) {
  const { t } = usePrefs();
  const [secret, setSecret] = useState<Secret | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    document.title = t("Coumba · second téléphone", "Coumba · second phone");
  }, [t]);

  if (!payload) {
    return (
      <div className="flex flex-1 flex-col justify-center px-5">
        <EmptyState
          icon={<Logo size={28} withName={false} />}
          title={t("Aucun lien de signature", "No signing link")}
          body={t(
            "Ouvrez cette page depuis le QR des réglages, sur le téléphone qui a créé la démo.",
            "Open this page from the QR in Settings, on the phone that created the demo.",
          )}
          action={
            <ButtonLink href="/app" variant="secondary" className="w-full">
              {t("Retour à la démo", "Back to the demo")}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  if (!secret) {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-6 pb-8 pt-10">
        <p className="text-center text-[13px] font-semibold text-brand-ink">{payload.config.name}</p>
        <h1 className="mt-3 text-center text-[24px] font-bold">{t(`Téléphone de ${PEOPLE.O2.first}`, `${PEOPLE.O2.first}'s phone`)}</h1>
        <p className="mx-auto mt-2 max-w-[280px] text-center text-[14px] leading-snug text-ink-2">
          {t(
            "Le même code à 8 chiffres que sur l'autre téléphone. Il n'est pas dans le lien. Cette page ne remplace pas la démo de ce navigateur.",
            "The same 8-digit code as on the other phone. It is not in the link. This page does not replace the demo already on this browser.",
          )}
        </p>
        <div className="mt-auto w-full pt-6">
          <PinPad
            busy={busy}
            error={error}
            resetKey={attempt}
            onComplete={(code) => {
              setBusy(true);
              setError(null);
              void decryptKey(payload.key, code)
                .then((plain) => {
                  const parsed = JSON.parse(new TextDecoder().decode(plain)) as { mnemonic: string; nostrSecretHex: string };
                  setSecret({ mnemonic: parsed.mnemonic, nostrSecret: fromHex(parsed.nostrSecretHex) });
                })
                .catch(() => {
                  setError(t("Code incorrect", "Wrong code"));
                  setAttempt((value) => value + 1);
                })
                .finally(() => setBusy(false));
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <DemoProvider config={payload.config} secrets={{ O2: secret }}>
      <PhoneApp role="O2" initial="requests" />
    </DemoProvider>
  );
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let index = 0; index < out.length; index += 1) out[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return out;
}
