import type { Role } from "@koinon/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { PhoneApp, roleLabel } from "../demo/PhoneApp";
import { Lab } from "../demo/Lab";
import { DemoProvider } from "../demo/context";
import { endpoints } from "../lib/api";
import { createDemoFund, errorCode, type OfficerRole, type SetupStep } from "../lib/flows";
import { usePrefs } from "../lib/prefs";
import { forgetFund, openSecret, readConfig, type FundConfig, type Secret } from "../lib/vault";
import { Button } from "../ui/button";
import { TopBar } from "../ui/chrome";
import { Field } from "../ui/field";
import { Logo } from "../ui/motif";
import { PhoneFrame } from "../ui/phone";
import { ErrorNote } from "../ui/query";
import { Code, RoleDot } from "../ui/status";
import { LangToggle, ThemeToggle } from "../ui/toggles";

const ROLES: Role[] = ["O1", "O2", "O3", "K"];
const PIN_MIN = 8;

export default function Demo() {
  const { t } = usePrefs();
  const [config, setConfig] = useState<FundConfig | null>(() => readConfig());
  const [secrets, setSecrets] = useState<Record<Role, Secret> | null>(null);
  const health = useQuery({ queryKey: ["health"], queryFn: endpoints.health, retry: 0 });

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
    <div className="flex min-h-dvh flex-col">
      <TopBar cta={false} />
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center gap-6 px-4 py-10">
        {health.isPending ? null : health.isError ? (
          <Offline error={health.error} retry={() => void health.refetch()} />
        ) : !health.data.demo ? (
          <Offline error={{ code: "DEMO_OFF" }} retry={() => void health.refetch()} />
        ) : null}
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
            disabled={!health.data?.demo}
            onCreated={(created, opened) => {
              setConfig(created);
              setSecrets(opened);
            }}
          />
        )}
      </main>
    </div>
  );
}

function Offline({ error, retry }: { error: unknown; retry: () => void }) {
  const { t } = usePrefs();
  const off = typeof error === "object" && error !== null && (error as { code?: string }).code === "DEMO_OFF";
  if (!off) return <ErrorNote error={error} onRetry={retry} />;
  return (
    <div role="alert" className="flex flex-col items-start gap-2 rounded-[var(--radius-card)] bg-[color-mix(in_srgb,var(--color-pending)_9%,transparent)] p-4">
      <Code tone="muted">KOINON_DEMO=0</Code>
      <p className="text-[13.5px] text-text-2">
        {t("Ce coordinateur n'a pas le robinet regtest. Lancez-le avec KOINON_DEMO=1.", "This coordinator has no regtest faucet. Start it with KOINON_DEMO=1.")}
      </p>
    </div>
  );
}

function Panel({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children: ReactNode }) {
  return (
    <section className="rise flex flex-col gap-5 rounded-[24px] bg-panel p-6 hairline sm:p-7">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-text-3">{eyebrow}</span>
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em]">{title}</h1>
      </div>
      {children}
    </section>
  );
}

const stepOrder: SetupStep[] = ["keys", "register", "members", "dues", "done"];

function Setup({ disabled, onCreated }: { disabled: boolean; onCreated: (config: FundConfig, secrets: Record<Role, Secret>) => void }) {
  const { t } = usePrefs();
  const [name, setName] = useState("Association des ressortissants de Kolda");
  const [pin, setPin] = useState("");
  const [touched, setTouched] = useState(false);
  const [progress, setProgress] = useState<{ step: SetupStep; done: number; total: number } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const pinError = touched && pin.length < PIN_MIN ? t(`${PIN_MIN} caractères minimum.`, `${PIN_MIN} characters minimum.`) : null;
  const nameError = touched && name.trim().length === 0 ? t("Le nom est requis.", "A name is required.") : null;

  const stepLabel: Record<SetupStep, string> = {
    keys: t("Créer 4 clés dans ce navigateur", "Create 4 keys in this browser"),
    register: t("Enregistrer les clés publiques", "Register the public keys"),
    members: t("Ajouter 12 membres", "Add 12 members"),
    dues: t("Payer les cotisations (regtest)", "Pay the dues (regtest)"),
    done: t("Prêt", "Ready"),
  };

  const create = async () => {
    setTouched(true);
    if (pin.length < PIN_MIN || name.trim().length === 0) return;
    setFailure(null);
    try {
      const config = await createDemoFund({
        name: name.trim(),
        pin,
        labels: { O1: "Trésorier", O2: "Secrétaire", O3: "Président", K: "Assemblée" },
        onStep: (step, done, total) => setProgress({ step, done, total }),
      });
      const opened = {} as Record<Role, Secret>;
      for (const role of ROLES) opened[role] = await openSecret(role, pin);
      onCreated(config, opened);
    } catch (error) {
      setFailure(errorCode(error));
      setProgress(null);
    }
  };

  const running = progress !== null;
  const current = progress ? stepOrder.indexOf(progress.step) : -1;

  return (
    <Panel
      eyebrow={t("Démo · regtest", "Demo · regtest")}
      title={
        <>
          {t("Créer une caisse à ", "Create a cashbox with ")}
          <em className="accent">{t("deux clés", "two keys")}</em>
        </>
      }
    >
      {running ? (
        <ol className="flex flex-col gap-3" aria-live="polite">
          {stepOrder.slice(0, 4).map((step, index) => {
            const state = index < current ? "done" : index === current ? "now" : "next";
            return (
              <li key={step} className="flex items-center gap-3 text-[14px]">
                <span
                  aria-hidden
                  className={`grid size-6 place-items-center rounded-full font-mono text-[11px] ${
                    state === "done" ? "bg-brand text-on-brand" : state === "now" ? "bg-raise text-text hairline-strong" : "bg-raise text-text-3"
                  }`}
                >
                  {state === "done" ? "✓" : index + 1}
                </span>
                <span className={state === "next" ? "text-text-3" : "text-text"}>{stepLabel[step]}</span>
                {state === "now" && progress ? (
                  <span className="ml-auto font-mono text-[12px] text-text-3">
                    {progress.done}/{progress.total}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <Field label={t("Nom de l'association", "Association name")} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} error={nameError} />
          <Field
            label={t("Code de ce navigateur", "Code for this browser")}
            type="password"
            autoComplete="new-password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            error={pinError}
            hint={t("Chiffre les 4 clés ici. Il ne quitte jamais cet appareil.", "Encrypts the 4 keys here. It never leaves this device.")}
          />
          <p className="text-[12.5px] leading-snug text-text-3">
            {t(
              "Pour la démo, ce navigateur tient les trois clés du bureau et celle de l'assemblée. Une vraie caisse garde une clé par téléphone.",
              "For the demo, this browser holds all three officer keys and the assembly key. A real fund keeps one key per phone.",
            )}
          </p>
          {failure ? (
            <div role="alert" className="flex items-center gap-2">
              <Code>{failure}</Code>
              <span className="text-[13px] text-text-2">{t("Rien n'a été créé côté serveur, ou partiellement : réessayez.", "Nothing, or only part, was created: try again.")}</span>
            </div>
          ) : null}
          <Button type="submit" size="lg" arrow disabled={disabled}>
            {t("Créer le fonds", "Create the fund")}
          </Button>
        </form>
      )}
    </Panel>
  );
}

function Unlock({ config, onOpen, onForget }: { config: FundConfig; onOpen: (secrets: Record<Role, Secret>) => void; onForget: () => void }) {
  const { t } = usePrefs();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const open = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const opened = {} as Record<Role, Secret>;
      for (const role of ROLES) opened[role] = await openSecret(role, pin);
      onOpen(opened);
    } catch (error) {
      const code = errorCode(error);
      setFailure(code === "NO_KEY" ? t("Aucune clé dans ce navigateur.", "No key in this browser.") : t("Code incorrect.", "Wrong code."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel eyebrow={t("Clés chiffrées", "Encrypted keys")} title={<span className="break-words">{config.name}</span>}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (pin.length > 0) void open();
        }}
      >
        <Field label={t("Code de ce navigateur", "Code for this browser")} type="password" autoComplete="current-password" autoFocus value={pin} onChange={(event) => setPin(event.target.value)} error={failure} />
        <Button type="submit" size="lg" busy={busy ? t("Déchiffrement…", "Decrypting…") : false} disabled={pin.length === 0} arrow>
          {t("Ouvrir", "Open")}
        </Button>
        <button type="button" onClick={onForget} className="self-start text-[13px] text-text-3 underline-offset-4 hover:text-text hover:underline">
          {t("Code oublié : recommencer une démo", "Forgot the code: start a new demo")}
        </button>
      </form>
    </Panel>
  );
}

type View = OfficerRole | "lab";

function Stage() {
  const { t } = usePrefs();
  const [view, setView] = useState<View>("O1");
  const views: { id: View; label: string }[] = [
    { id: "O1", label: roleLabel("O1", t) },
    { id: "O2", label: roleLabel("O2", t) },
    { id: "lab", label: t("Réseau", "Network") },
  ];

  const wide = useWide();

  if (wide) {
    return (
      <div className="flex min-h-dvh flex-col">
        <TopBar cta={false}>
          <span className="ml-2 hidden font-mono text-[12px] uppercase tracking-[0.14em] text-text-3 2xl:inline">{t("démo · regtest", "demo · regtest")}</span>
        </TopBar>
        <main className="mx-auto grid w-full max-w-[1320px] flex-1 grid-cols-[360px_minmax(300px,1fr)_360px] items-start gap-8 px-6 py-8">
          <PhoneFrame owner="O1" ownerLabel={t("Téléphone du Trésorier", "Treasurer's phone")}>
            <PhoneApp role="O1" framed />
          </PhoneFrame>
          <Lab className="h-[760px]" />
          <PhoneFrame owner="O2" ownerLabel={t("Téléphone de la Secrétaire", "Secretary's phone")}>
            <PhoneApp role="O2" framed initialTab="requests" />
          </PhoneFrame>
        </main>
      </div>
    );
  }

  return (
      <div className="flex h-dvh flex-col">
        <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 pb-2 pt-[max(env(safe-area-inset-top),8px)]">
          <Link href="/" aria-label={t("Accueil Koinon", "Koinon home")} className="shrink-0">
            <Logo className="[&>span]:hidden" />
          </Link>
          <div role="tablist" aria-label={t("Qui tient le téléphone", "Who holds the phone")} className="grid flex-1 grid-cols-3 rounded-[var(--radius-ctl)] bg-raise p-0.5 hairline">
            {views.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={view === item.id}
                onClick={() => setView(item.id)}
                className={`flex h-9 min-w-0 items-center justify-center gap-1.5 truncate rounded-[8px] px-1 text-[13px] font-medium transition-colors ${
                  view === item.id ? "bg-panel text-text shadow-[0_1px_0_var(--color-line-strong)]" : "text-text-3"
                }`}
              >
                {item.id !== "lab" ? <RoleDot role={item.id} className="size-1.5" /> : null}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
          <span className="max-sm:hidden">
            <LangToggle />
          </span>
          <ThemeToggle />
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          {view === "lab" ? (
            <Lab className="flex-1 overflow-hidden p-3" />
          ) : (
            <PhoneFrame framed={false} key={view}>
              <PhoneApp role={view} framed={false} initialTab={view === "O2" ? "requests" : "fund"} />
            </PhoneFrame>
          )}
        </div>
      </div>
  );
}

const WIDE = "(min-width: 1280px)";

function useWide(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE).matches);
  useEffect(() => {
    const query = window.matchMedia(WIDE);
    const update = () => setWide(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}
