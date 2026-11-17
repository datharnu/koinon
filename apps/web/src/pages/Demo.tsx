import type { Role } from "@koinon/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { DemoProvider } from "../demo/context";
import { CheatSheet, FloatingToolbar, NetworkSheet } from "../demo/Network";
import { PhoneApp } from "../demo/PhoneApp";
import { Note, ScreenHeader, StickyFooter } from "../demo/ui";
import { endpoints } from "../lib/api";
import { createDemoFund, errorCode, type OfficerRole, type SetupStep } from "../lib/flows";
import { useMedia } from "../lib/media";
import { createPasskey, passkeyAvailable, PasskeyError, readUnlock, unlockWithPasskey, writeUnlock, type UnlockMethod } from "../lib/passkey";
import { PEOPLE, roleTitle } from "../lib/people";
import { usePrefs } from "../lib/prefs";
import { forgetFund, openSecret, readConfig, type FundConfig, type Secret } from "../lib/vault";
import { Avatar, Chip } from "../ui/avatar";
import { Button, ButtonLink, Spinner } from "../ui/button";
import { IconAlert, IconCheck, IconCube, IconPasskey, IconX, Logo } from "../ui/icons";
import { PhoneFrame } from "../ui/phone";
import { PinPad } from "../ui/pinpad";
import { Sheet } from "../ui/sheet";
import { LangToggle, ThemeToggle } from "../ui/toggles";

const ROLES: Role[] = ["O1", "O2", "O3", "K"];

async function openAll(secret: string): Promise<Record<Role, Secret>> {
  const opened = {} as Record<Role, Secret>;
  for (const role of ROLES) opened[role] = await openSecret(role, secret);
  return opened;
}

export default function Demo() {
  const { t } = usePrefs();
  const [config, setConfig] = useState<FundConfig | null>(() => readConfig());
  const [secrets, setSecrets] = useState<Record<Role, Secret> | null>(null);

  useEffect(() => {
    document.title = t("Koinon · démo", "Koinon · demo");
  }, [t]);

  if (config && secrets) {
    return (
      <DemoProvider config={config} secrets={secrets}>
        <Stage />
      </DemoProvider>
    );
  }

  return (
    <Onboarding>
      {config ? (
        <Unlock
          config={config}
          onOpen={setSecrets}
          onForget={() => {
            forgetFund();
            setConfig(null);
          }}
        />
      ) : (
        <Setup
          onCreated={(created, opened) => {
            setConfig(created);
            setSecrets(opened);
          }}
        />
      )}
    </Onboarding>
  );
}

function StageBar({ children }: { children?: ReactNode }) {
  const { t } = usePrefs();
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 px-5">
      <Link href="/" aria-label={t("Accueil Koinon", "Koinon home")}>
        <Logo withName />
      </Link>
      <Chip tone="warn" dot className="max-sm:hidden">
        {t("Démo · regtest", "Demo · regtest")}
      </Chip>
      <div className="flex-1" />
      {children}
      <LangToggle />
      <ThemeToggle />
    </header>
  );
}

/** Before the keys are open, the phone shows the welcome, setup or unlock screen. */
function Onboarding({ children }: { children: ReactNode }) {
  const framed = useMedia("(min-width: 640px)");
  if (!framed) {
    return <div className="flex h-dvh flex-col bg-surface">{children}</div>;
  }
  return (
    <div className="flex min-h-dvh flex-col">
      <StageBar />
      <main className="flex flex-1 items-center justify-center px-4 pb-10 pt-2">
        <PhoneFrame>{children}</PhoneFrame>
      </main>
    </div>
  );
}

function useHealth() {
  return useQuery({ queryKey: ["health"], queryFn: endpoints.health, retry: 0 });
}

const stepOrder: SetupStep[] = ["keys", "register", "members", "dues", "done"];

type SetupView = { name: "welcome"; failure?: string } | { name: "code" } | { name: "confirm"; code: string; mismatches?: number } | { name: "progress" };

function Setup({ onCreated }: { onCreated: (config: FundConfig, secrets: Record<Role, Secret>) => void }) {
  const { t } = usePrefs();
  const health = useHealth();
  const [name, setName] = useState("Association des ressortissants de Kolda");
  const [view, setView] = useState<SetupView>({ name: "welcome" });
  const [progress, setProgress] = useState<{ step: SetupStep; done: number; total: number } | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  const offline = health.isError || (health.data !== undefined && !health.data.demo);
  const canCreate = health.data?.demo === true && name.trim().length > 0;

  const build = async (secret: string, method: UnlockMethod) => {
    setView({ name: "progress" });
    try {
      const config = await createDemoFund({
        name: name.trim(),
        pin: secret,
        labels: { O1: "Trésorier", O2: "Secrétaire", O3: "Président", K: "Assemblée" },
        onStep: (step, done, total) => setProgress({ step, done, total }),
      });
      writeUnlock(method);
      onCreated(config, await openAll(secret));
    } catch (error) {
      setProgress(null);
      setView({ name: "welcome", failure: errorCode(error) });
    }
  };

  const withPasskey = async () => {
    setPasskeyBusy(true);
    try {
      const made = await createPasskey(name.trim());
      setPasskeyBusy(false);
      await build(made.secret, made.method);
    } catch (error) {
      setPasskeyBusy(false);
      const code = error instanceof PasskeyError ? error.code : "FAILED";
      if (code === "CANCELLED") return;
      setView({ name: "welcome", failure: code === "NO_PRF" || code === "UNSUPPORTED" ? "NO_PRF" : code });
    }
  };

  if (view.name === "progress") return <Progress progress={progress} />;

  if (view.name === "code" || view.name === "confirm") {
    return (
      <>
        <ScreenHeader title="" onBack={() => setView({ name: "welcome" })} />
        <div className="flex flex-1 flex-col items-center px-6 pb-8">
          <h1 className="text-center text-[24px] font-bold">{view.name === "code" ? t("Choisissez un code", "Choose a code") : t("Confirmez le code", "Confirm the code")}</h1>
          <p className="mt-2 max-w-[280px] text-center text-[14px] leading-snug text-ink-2">
            {t("8 chiffres. Ils chiffrent les clés sur cet appareil et n'en sortent jamais.", "8 digits. They encrypt the keys on this device and never leave it.")}
          </p>
          <div className="mt-auto w-full pt-6">
            <PinPad
              resetKey={view.name === "confirm" ? `confirm-${view.mismatches ?? 0}` : "code"}
              error={view.name === "confirm" && view.mismatches ? t("Les codes ne correspondent pas", "The codes don't match") : null}
              onComplete={(code) => {
                if (view.name === "code") setView({ name: "confirm", code });
                else if (code === view.code) void build(code, { method: "code" });
                else setView({ name: "confirm", code: view.code, mismatches: (view.mismatches ?? 0) + 1 });
              }}
            />
          </div>
        </div>
      </>
    );
  }

  const failure = view.failure;
  return (
    <>
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="relative mx-3 mt-3 flex flex-col items-center overflow-hidden rounded-[32px] bg-brand-soft px-6 pb-8 pt-10">
          <Logo size={56} />
          <div className="mt-6 flex -space-x-3">
            {(["O1", "O2", "O3"] as const).map((role, index) => (
              <span key={role} className="fade-up" style={{ animationDelay: `${120 + index * 90}ms` }}>
                <Avatar name={PEOPLE[role].name} tone={PEOPLE[role].tone} size={48} ring />
              </span>
            ))}
          </div>
          <p className="mt-3 text-[13px] font-semibold text-brand-ink">{t("2 signatures sur 3 pour chaque dépense", "2 of 3 signatures for every spend")}</p>
        </div>
        <div className="flex flex-col gap-4 px-6 pb-4 pt-6">
          <div>
            <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em]">{t("Une caisse que personne ne vide seul.", "A fund nobody can empty alone.")}</h1>
            <p className="mt-2 text-[14.5px] leading-snug text-ink-2">
              {t(
                "Créez une caisse de démo : trois membres du bureau, douze membres qui cotisent, de vrais bitcoins de test.",
                "Create a demo fund: three officers, twelve paying members, real test bitcoin.",
              )}
            </p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-2">{t("Nom de l'association", "Association name")}</span>
            <input
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              className="h-12 rounded-2xl bg-card px-4 text-base font-medium focus:outline-none focus:ring-2 focus:ring-brand sm:text-[15px]"
            />
          </label>
          {offline ? (
            <Note tone="bad" icon={<IconAlert size={16} />}>
              {health.isError
                ? t("Le serveur de démo ne répond pas. Lancez le coordinateur puis réessayez.", "The demo server is not answering. Start the coordinator and try again.")
                : t("Ce serveur n'a pas le robinet regtest (KOINON_DEMO=1).", "This server has no regtest faucet (KOINON_DEMO=1).")}
              <button type="button" onClick={() => void health.refetch()} className="ml-1 font-semibold underline">
                {t("Réessayer", "Retry")}
              </button>
            </Note>
          ) : null}
          {failure ? (
            <Note tone="bad" icon={<IconAlert size={16} />}>
              {failure === "NO_PRF"
                ? t("Cette passkey ne sait pas chiffrer des clés sur ce navigateur. Utilisez un code à 8 chiffres.", "This passkey can't encrypt keys on this browser. Use an 8-digit code.")
                : t(`La création a échoué (${failure}). Rien n'est perdu : réessayez.`, `Creation failed (${failure}). Nothing is lost: try again.`)}
            </Note>
          ) : null}
        </div>
      </div>
      <StickyFooter>
        <div className="flex flex-col gap-1">
          {passkeyAvailable() && failure !== "NO_PRF" ? (
            <>
              <Button size="lg" block icon={<IconPasskey size={20} />} onClick={() => void withPasskey()} busy={passkeyBusy ? t("En attente de la passkey…", "Waiting for the passkey…") : false} disabled={!canCreate}>
                {t("Créer avec une passkey", "Create with a passkey")}
              </Button>
              <Button variant="ghost" block onClick={() => setView({ name: "code" })} disabled={!canCreate || passkeyBusy}>
                {t("Utiliser un code à 8 chiffres", "Use an 8-digit code")}
              </Button>
            </>
          ) : (
            <Button size="lg" block onClick={() => setView({ name: "code" })} disabled={!canCreate}>
              {t("Choisir un code", "Choose a code")}
            </Button>
          )}
        </div>
      </StickyFooter>
    </>
  );
}

function Progress({ progress }: { progress: { step: SetupStep; done: number; total: number } | null }) {
  const { t } = usePrefs();
  const labels: Record<SetupStep, string> = {
    keys: t("Créer 4 clés sur cet appareil", "Create 4 keys on this device"),
    register: t("Enregistrer les clés publiques", "Register the public keys"),
    members: t("Ajouter 12 membres", "Add 12 members"),
    dues: t("Encaisser les cotisations", "Collect the dues"),
    done: t("Prêt", "Ready"),
  };
  const current = progress ? stepOrder.indexOf(progress.step) : 0;
  const ratio = progress ? (current + progress.done / Math.max(progress.total, 1)) / 4 : 0;
  return (
    <div className="flex flex-1 flex-col justify-center px-6">
      <h1 className="text-[24px] font-bold">{t("Création de la caisse", "Creating the fund")}</h1>
      <p className="mt-1 text-[14px] text-ink-2">{t("Quelques secondes.", "A few seconds.")}</p>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-card" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
        <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
      </div>
      <ol className="mt-6 flex flex-col gap-1 rounded-[22px] bg-card p-2" aria-live="polite">
        {stepOrder.slice(0, 4).map((step, index) => {
          const state = index < current ? "done" : index === current ? "now" : "next";
          return (
            <li key={step} className="flex min-h-[52px] items-center gap-3 rounded-2xl px-3">
              <span className={`grid size-7 shrink-0 place-items-center rounded-full ${state === "done" ? "pop bg-good text-white" : state === "now" ? "bg-surface text-brand" : "bg-surface text-ink-3"}`}>
                {state === "done" ? <IconCheck size={15} /> : state === "now" ? <Spinner size={15} /> : <span className="text-[12px] font-bold">{index + 1}</span>}
              </span>
              <span className={`flex-1 text-[14.5px] font-semibold ${state === "next" ? "text-ink-3" : ""}`}>{labels[step]}</span>
              {state === "now" && progress && progress.total > 1 ? (
                <span className="tabular text-[13px] text-ink-3">
                  {progress.done}/{progress.total}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Unlock({ config, onOpen, onForget }: { config: FundConfig; onOpen: (secrets: Record<Role, Secret>) => void; onForget: () => void }) {
  const { t } = usePrefs();
  const method = readUnlock();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [forgetting, setForgetting] = useState(false);

  const open = async (secret: () => Promise<string>) => {
    setBusy(true);
    setFailure(null);
    try {
      onOpen(await openAll(await secret()));
    } catch (error) {
      if (error instanceof PasskeyError) {
        if (error.code !== "CANCELLED") setFailure(t("La passkey n'a pas répondu.", "The passkey did not answer."));
      } else {
        setFailure(errorCode(error) === "NO_KEY" ? t("Aucune clé sur cet appareil", "No key on this device") : t("Code incorrect", "Wrong code"));
        setAttempt((value) => value + 1);
      }
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-1 flex-col items-center px-6 pt-12 text-center">
        <Logo size={52} />
        <h1 className="mt-5 text-[26px] font-bold">{t("Bon retour", "Welcome back")}</h1>
        <p className="mt-1 max-w-full truncate text-[14.5px] text-ink-2" title={config.name}>
          {config.name}
        </p>
        {method?.method === "code" ? (
          <div className="mt-auto w-full pb-6 pt-6">
            <PinPad busy={busy} error={failure} resetKey={attempt} onComplete={(code) => void open(async () => code)} />
          </div>
        ) : method?.method === "passkey" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <span className={`grid size-24 place-items-center rounded-full bg-brand-soft text-brand ${busy ? "pulse-soft" : ""}`}>
              <IconPasskey size={44} />
            </span>
            <p className="max-w-[260px] text-[14px] leading-snug text-ink-2">
              {t("Déverrouillez avec Face ID, Touch ID ou le code de votre téléphone.", "Unlock with Face ID, Touch ID or your phone's passcode.")}
            </p>
            {failure ? (
              <p role="alert" className="text-[13.5px] font-semibold text-bad">
                {failure}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center">
            <Note icon={<IconAlert size={16} />}>{t("Cette démo date d'une version précédente. Recommencez-en une.", "This demo comes from an earlier version. Start a new one.")}</Note>
          </div>
        )}
      </div>
      <StickyFooter>
        <div className="flex flex-col gap-1">
          {method?.method === "passkey" ? (
            <Button size="lg" block icon={<IconPasskey size={20} />} busy={busy ? t("Déverrouillage…", "Unlocking…") : false} onClick={() => void open(() => unlockWithPasskey(method))}>
              {t("Déverrouiller", "Unlock")}
            </Button>
          ) : null}
          <Button variant="ghost" block onClick={() => setForgetting(true)} disabled={busy}>
            {method ? t("Recommencer une démo", "Start a new demo") : t("Nouvelle démo", "New demo")}
          </Button>
        </div>
      </StickyFooter>
      <Sheet
        open={forgetting}
        contained
        onClose={() => setForgetting(false)}
        title={t("Recommencer ?", "Start over?")}
        footer={
          <Button variant="danger" size="lg" block onClick={onForget}>
            {t("Effacer les clés de démo", "Erase the demo keys")}
          </Button>
        }
      >
        <p className="pb-1 text-[14px] leading-snug text-ink-2">
          {t("Les clés de démo quittent cet appareil. La caisse regtest reste sur le serveur.", "The demo keys leave this device. The regtest fund stays on the server.")}
        </p>
      </Sheet>
    </>
  );
}

function Caption({ role }: { role: OfficerRole }) {
  const { t } = usePrefs();
  const person = PEOPLE[role];
  return (
    <>
      <Avatar name={person.name} tone={person.tone} size={26} />
      <span className="font-semibold text-ink">{t(`Téléphone ${/^[aeiouy]/i.test(person.first) ? "d'" : "de "}${person.first}`, `${person.first}'s phone`)}</span>
      <span className="text-ink-3">· {roleTitle(role, t)}</span>
    </>
  );
}

const STAGE_ROLES: OfficerRole[] = ["O1", "O2"];

function Stage() {
  const { t } = usePrefs();
  const wide = useMedia("(min-width: 1180px)");
  const framed = useMedia("(min-width: 640px)");
  const [cheat, setCheat] = useState(false);
  const [network, setNetwork] = useState(false);
  const [holder, setHolder] = useState<OfficerRole>("O1");

  const switcher = (
    <div role="tablist" aria-label={t("Qui tient le téléphone", "Who holds the phone")} className="flex h-10 items-center gap-1 rounded-full bg-card p-1">
      {STAGE_ROLES.map((role) => (
        <button
          key={role}
          type="button"
          role="tab"
          aria-selected={holder === role}
          onClick={() => setHolder(role)}
          className={`press flex h-8 items-center gap-1.5 rounded-full pl-1 pr-3 text-[13px] font-semibold transition-colors ${holder === role ? "bg-surface text-ink shadow-[0_1px_4px_-1px_rgb(0_0_0/0.15)]" : "text-ink-3"}`}
        >
          <Avatar name={PEOPLE[role].name} tone={PEOPLE[role].tone} size={24} />
          {PEOPLE[role].first}
        </button>
      ))}
    </div>
  );

  if (wide) {
    return (
      <div className="flex min-h-dvh flex-col">
        <StageBar>
          <ButtonLink href="/" variant="ghost" size="sm" icon={<IconX size={16} />}>
            {t("Quitter", "Exit")}
          </ButtonLink>
        </StageBar>
        <main className="flex flex-1 items-start justify-center gap-14 px-6 pb-28 pt-2">
          {STAGE_ROLES.map((role) => (
            <PhoneFrame key={role} caption={<Caption role={role} />}>
              <PhoneApp role={role} initial={role === "O2" ? "requests" : "home"} />
            </PhoneFrame>
          ))}
        </main>
        <FloatingToolbar onCheat={() => setCheat(true)} />
        <CheatSheet open={cheat} onClose={() => setCheat(false)} />
      </div>
    );
  }

  if (framed) {
    return (
      <div className="flex min-h-dvh flex-col">
        <StageBar>{switcher}</StageBar>
        <main className="flex flex-1 items-start justify-center px-4 pb-28 pt-2">
          {STAGE_ROLES.map((role) => (
            <div key={role} style={{ display: holder === role ? "contents" : "none" }}>
              <PhoneFrame caption={<Caption role={role} />}>
                <PhoneApp role={role} initial={role === "O2" ? "requests" : "home"} />
              </PhoneFrame>
            </div>
          ))}
        </main>
        <FloatingToolbar onCheat={() => setCheat(true)} />
        <CheatSheet open={cheat} onClose={() => setCheat(false)} />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-surface">
      <header className="flex shrink-0 items-center gap-2 px-3 pb-1 pt-[max(env(safe-area-inset-top),10px)]">
        <Link href="/" aria-label={t("Accueil Koinon", "Koinon home")}>
          <Logo size={32} withName={false} />
        </Link>
        <div className="flex flex-1 justify-center">{switcher}</div>
        <button type="button" onClick={() => setNetwork(true)} aria-label={t("Réseau de test", "Test network")} className="press grid size-10 place-items-center rounded-full bg-card text-ink">
          <IconCube size={19} />
        </button>
      </header>
      {STAGE_ROLES.map((role) => (
        <div key={role} style={{ display: holder === role ? "contents" : "none" }}>
          <PhoneFrame framed={false}>
            <PhoneApp role={role} initial={role === "O2" ? "requests" : "home"} />
          </PhoneFrame>
        </div>
      ))}
      <NetworkSheet open={network} onClose={() => setNetwork(false)} />
    </div>
  );
}
