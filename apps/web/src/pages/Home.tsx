import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePrefs, useT } from "../lib/prefs";
import { ButtonLink } from "../ui/button";
import { Footer, REPO_URL, TopBar } from "../ui/chrome";
import { Keyhole, Locks, SectionLabel } from "../ui/motif";
import { PhoneFrame, StatusBar } from "../ui/phone";
import { Code, RegtestBadge, RoleChip, StatePill, type UiState } from "../ui/status";

export function Home() {
  return (
    <>
      <TopBar />
      <main className="rise">
        <Hero />
        <Problem />
        <HowItWorks />
        <Refusals />
        <Status />
        <Faq />
        <Closing />
      </main>
      <Footer />
    </>
  );
}

function Section({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`mx-auto max-w-[1180px] px-4 py-20 sm:px-6 sm:py-28 ${className}`}>
      {children}
    </section>
  );
}

function Heading({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mt-5 flex max-w-[720px] flex-col gap-4">
      <h2 className="text-[32px] sm:text-[42px]">{children}</h2>
      {sub ? <p className="text-[17px] leading-relaxed text-text-2">{sub}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- hero */

function Hero() {
  const t = useT();
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div aria-hidden className="dotgrid pointer-events-none absolute inset-0 [mask-image:radial-gradient(70%_60%_at_70%_40%,black,transparent)]" />
      <div className="relative mx-auto grid max-w-[1180px] items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:pb-28 lg:pt-20">
        <div className="flex flex-col items-start gap-7">
          <span className="inline-flex items-center gap-2 rounded-full bg-raise py-1 pl-1.5 pr-3 text-[13px] text-text-2 hairline">
            <span className="rounded-full bg-[color-mix(in_srgb,var(--color-o1)_18%,transparent)] px-2 py-0.5 font-mono text-[11px] text-o1">Dakar Bitcoin Hack 2026</span>
            {t("Démo regtest en ligne", "Live regtest demo")}
          </span>
          <h1 className="max-w-[760px] text-[44px] sm:text-[64px]">
            {t("La caisse de l'association s'ouvre avec ", "The association's cashbox opens with ")}
            <em className="accent text-brand">{t("deux", "two")}</em>
            {t(" clés.", " keys.")}
          </h1>
          <p className="max-w-[600px] text-[18px] leading-relaxed text-text-2">
            {t(
              "Koinon est un fonds Bitcoin partagé pour un dahira, un GIE ou un club. Le trésorier ne peut pas dépenser seul : deux responsables sur trois signent depuis leur propre téléphone, et chaque membre voit chaque franc.",
              "Koinon is a shared Bitcoin fund for a dahira, a GIE or a club. The treasurer cannot spend alone: two of three officers sign from their own phone, and every member sees every franc.",
            )}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/app" size="lg" arrow>
              {t("Ouvrir l'app", "Open the app")}
            </ButtonLink>
            <ButtonLink href="#refus" variant="secondary" size="lg">
              {t("Voir ce que le réseau refuse", "See what the network refuses")}
            </ButtonLink>
          </div>
          <dl className="grid w-full max-w-[600px] grid-cols-3 gap-px overflow-hidden rounded-[var(--radius-card)] bg-line hairline">
            {[
              ["2 / 3", t("signatures pour dépenser", "signatures to spend")],
              ["9 / 9", t("vérifications e2e en CI", "e2e checks in CI")],
              ["0", t("clé privée sur le serveur", "private keys on the server")],
            ].map(([value, label]) => (
              <div key={label} className="flex flex-col gap-1 bg-ink p-4">
                <dt className="sr-only">{label}</dt>
                <dd className="font-mono text-[22px] tabular text-text">{value}</dd>
                <dd className="text-[13px] leading-snug text-text-3">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <HeroPhone />
      </div>
    </section>
  );
}

type Frame = 0 | 1 | 2 | 3;

/** One autoplay, stopped by touch or hover. Reduced motion shows the most telling frame. */
function HeroPhone() {
  const { t, lang } = usePrefs();
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [frame, setFrame] = useState<Frame>(reduce ? 1 : 0);
  const [held, setHeld] = useState(reduce);
  useEffect(() => {
    if (held) return;
    const timer = window.setInterval(() => setFrame((value) => ((value + 1) % 4) as Frame), 2600);
    return () => window.clearInterval(timer);
  }, [held]);

  const signers = frame >= 2 ? (["O1", "O2"] as const) : (["O1"] as const);
  const state: UiState = frame === 1 ? "REFUSE" : frame === 3 ? "ALLOW" : frame === 2 ? "ALLOW" : "PENDING";
  const stateText =
    frame === 0
      ? t("En attente d'une 2ᵉ clé", "Waiting for a 2nd key")
      : frame === 1
        ? t("Refusé par le réseau", "Refused by the network")
        : frame === 2
          ? t("2 clés · prêt à diffuser", "2 keys · ready to broadcast")
          : t("Diffusé · confirmé", "Broadcast · confirmed");

  return (
    <div
      className="mx-auto max-lg:scale-[0.92]"
      onPointerEnter={() => setHeld(true)}
      onPointerDown={() => setHeld(true)}
      onPointerLeave={() => !reduce && setHeld(false)}
    >
      <PhoneFrame>
        <StatusBar right={<RegtestBadge label="regtest" />} />
        <div className="flex flex-1 flex-col gap-4 px-5 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold">Dahira Démo</span>
            <RoleChip role="O2" label={t("Secrétaire", "Secretary")} />
          </div>
          <div className="rounded-[var(--radius-card)] bg-panel p-4 hairline">
            <span className="text-[12px] text-text-3">{t("Solde du fonds", "Fund balance")}</span>
            <p className="mt-1 font-mono text-[28px] tabular">{lang === "fr" ? "60 000 F" : "60,000 F"}</p>
            <p className="font-mono text-[12px] text-text-3">{t("12 cotisations · sats sans valeur (regtest)", "12 dues · sats with no value (regtest)")}</p>
          </div>
          <div key={frame} className={`flex flex-col gap-3 rounded-[var(--radius-card)] bg-panel p-4 hairline ${frame === 1 ? "shake" : "arrive"}`}>
            <div className="flex items-center justify-between gap-2">
              <RoleChip role="O1" label={t("Trésorier", "Treasurer")} />
              <Locks signers={[...signers]} />
            </div>
            <div>
              <p className="font-mono text-[24px] tabular">{lang === "fr" ? "15 000 F" : "15,000 F"}</p>
              <p className="text-[14px] text-text-2">{t("Transport pour le Magal", "Transport for the Magal")}</p>
            </div>
            <StatePill state={state}>{stateText}</StatePill>
            {frame === 1 ? (
              <p className="rounded-lg bg-[color-mix(in_srgb,var(--color-refuse)_8%,transparent)] p-2.5 font-mono text-[11px] leading-relaxed text-refuse">
                bitcoind: Signature must be zero for failed CHECK(MULTI)SIG operation
              </p>
            ) : null}
            {frame === 3 ? (
              <p className="font-mono text-[11px] text-text-3">txid 9f9144…aa1728 · 1 conf</p>
            ) : null}
          </div>
          <p className="mt-auto pb-6 text-center text-[12px] text-text-3">
            {held && !reduce ? t("Animation en pause", "Animation paused") : t("Le trésorier tente seul, puis la secrétaire signe", "The treasurer tries alone, then the secretary signs")}
          </p>
        </div>
      </PhoneFrame>
    </div>
  );
}

/* ---------------------------------------------------------------- problem */

function Problem() {
  const t = useT();
  const rows: [string, string, string][] = [
    [t("Qui tient l'argent", "Who holds the money"), t("Le compte Wave personnel du trésorier", "The treasurer's personal Wave account"), t("Une adresse que trois responsables contrôlent ensemble", "An address three officers control together")],
    [t("Qui peut dépenser", "Who can spend"), t("Le trésorier, seul, à toute heure", "The treasurer, alone, at any time"), t("Deux responsables sur trois, chacun sur son téléphone", "Two of three officers, each on their own phone")],
    [t("Ce que voient les membres", "What members see"), t("Un compte rendu oral à la réunion", "A spoken report at the meeting"), t("Chaque cotisation et chaque dépense, en francs CFA", "Every due and every spend, in CFA francs")],
    [t("Si un responsable disparaît", "If an officer disappears"), t("L'argent part avec son téléphone", "The money leaves with their phone"), t("Un responsable et la clé de l'assemblée récupèrent le fonds, après un délai", "One officer and the assembly key recover the fund, after a delay")],
  ];
  return (
    <Section id="probleme">
      <SectionLabel index="01" name={t("Le problème", "The problem")} />
      <Heading sub={t("Les associations sénégalaises collectent des cotisations chaque semaine. Presque toujours, une seule personne les garde, et une dispute suffit à casser la confiance.", "Senegalese associations collect dues every week. Almost always, one person keeps them, and one dispute is enough to break trust.")}>
        {t("Aujourd'hui, la caisse a ", "Today, the cashbox has ")}
        <em className="accent">{t("une seule", "one")}</em>
        {t(" clé.", " key.")}
      </Heading>
      <div className="mt-12 overflow-hidden rounded-[var(--radius-card)] hairline">
        <div className="hidden grid-cols-[1fr_1.3fr_1.3fr] bg-panel px-5 py-3 font-mono text-[12px] uppercase tracking-[0.12em] text-text-3 md:grid">
          <span />
          <span>{t("Aujourd'hui", "Today")}</span>
          <span className="text-brand">Koinon</span>
        </div>
        {rows.map(([label, today, koinon]) => (
          <div key={label} className="grid gap-2 border-t border-line px-5 py-4 first:border-t-0 md:grid-cols-[1fr_1.3fr_1.3fr] md:gap-4 md:first:border-t">
            <span className="text-[14px] font-medium text-text">{label}</span>
            <span className="flex gap-2 text-[15px] text-text-2">
              <span className="font-mono text-[12px] text-text-3 md:hidden">{t("Avant", "Before")}</span>
              {today}
            </span>
            <span className="flex gap-2 text-[15px] text-text">
              <span className="font-mono text-[12px] text-brand md:hidden">Koinon</span>
              {koinon}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- how it works */

function HowItWorks() {
  const { t, lang } = usePrefs();
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: t("Le trésorier demande", "The treasurer asks"),
      body: t(
        "Il saisit le montant en francs CFA, le destinataire et le motif. Le serveur fige le taux et le nombre de sats. La demande part chiffrée aux deux autres responsables par Nostr.",
        "He enters the amount in CFA francs, the recipient and the purpose. The server locks the rate and the sats. The request goes encrypted to the two other officers over Nostr.",
      ),
      spec: [
        [t("Qui agit", "Who acts"), t("Trésorier, avec sa clé", "Treasurer, with his key")],
        [t("Sur la chaîne", "On chain"), t("Rien encore", "Nothing yet")],
        [t("Impossible", "Cannot happen"), t("Changer le montant après coup", "Change the amount afterwards")],
      ],
      state: "PENDING" as UiState,
      signers: ["O1"] as const,
    },
    {
      title: t("Une 2ᵉ responsable vérifie et signe", "A 2nd officer checks and signs"),
      body: t(
        "Son téléphone relit la transaction lui-même : bon destinataire, bon montant, monnaie rendue au fonds, frais sous le plafond. Si le serveur a changé un octet, son téléphone refuse de signer.",
        "Her phone re-reads the transaction itself: right recipient, right amount, change back to the fund, fee under the cap. If the server changed one byte, her phone refuses to sign.",
      ),
      spec: [
        [t("Qui agit", "Who acts"), t("Secrétaire, sur son téléphone", "Secretary, on her phone")],
        [t("Sur la chaîne", "On chain"), t("Rien encore", "Nothing yet")],
        [t("Impossible", "Cannot happen"), t("Signer autre chose que ce qu'elle a lu", "Sign anything other than what she read")],
      ],
      state: "ALLOW" as UiState,
      signers: ["O1", "O2"] as const,
    },
    {
      title: t("Tout le monde le voit", "Everyone sees it"),
      body: t(
        "La transaction est diffusée. Bitcoin accepte deux signatures et rien de moins. La dépense apparaît dans le registre de chaque membre, en francs CFA.",
        "The transaction is broadcast. Bitcoin accepts two signatures and nothing less. The spend appears in every member's ledger, in CFA francs.",
      ),
      spec: [
        [t("Qui agit", "Who acts"), t("Le réseau Bitcoin", "The Bitcoin network")],
        [t("Sur la chaîne", "On chain"), t("Une transaction 2-sur-3", "One 2-of-3 transaction")],
        [t("Impossible", "Cannot happen"), t("Effacer la dépense du registre", "Erase the spend from the ledger")],
      ],
      state: "ALLOW" as UiState,
      signers: ["O1", "O2"] as const,
    },
  ];
  const current = steps[step] ?? steps[0]!;
  return (
    <Section id="comment" className="border-t border-line">
      <SectionLabel index="02" name={t("Comment ça marche", "How it works")} />
      <Heading>
        {t("Une dépense, ", "One spend, ")}
        <em className="accent">{t("trois", "three")}</em>
        {t(" étapes.", " steps.")}
      </Heading>
      <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <ol className="flex flex-col gap-2">
          {steps.map((item, index) => (
            <li key={item.title}>
              <button
                type="button"
                aria-expanded={step === index}
                onClick={() => setStep(index)}
                className={`flex w-full flex-col gap-2 rounded-[var(--radius-card)] p-5 text-left transition-colors ${step === index ? "bg-panel hairline-strong" : "hover:bg-panel"}`}
              >
                <span className="flex items-center gap-3">
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full font-mono text-[12px] ${step === index ? "bg-brand text-on-brand" : "bg-raise text-text-2"}`}>{index + 1}</span>
                  <span className="text-[18px] font-medium">{item.title}</span>
                </span>
                {step === index ? <span className="arrive pl-10 text-[15px] leading-relaxed text-text-2">{item.body}</span> : null}
              </button>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-panel p-5 hairline">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[12px] text-text-3">{t("Demande", "Request")} 4f2a…c91e</span>
            <Locks signers={[...current.signers]} />
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[30px] tabular">{lang === "fr" ? "15 000 F" : "15,000 F"}</p>
              <p className="font-mono text-[12px] text-text-3">{t("38 113 sats figés", "38,113 sats locked")}</p>
            </div>
            <StatePill state={current.state}>{step === 0 ? t("1 / 2 clés", "1 / 2 keys") : step === 1 ? t("2 / 2 clés", "2 / 2 keys") : t("Confirmé", "Confirmed")}</StatePill>
          </div>
          <dl className="flex flex-col">
            {current.spec.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4 border-t border-line py-2.5 text-[14px]">
                <dt className="text-text-3">{key}</dt>
                <dd className="text-right text-text">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex gap-2">
            <button type="button" disabled={step === 0} onClick={() => setStep((value) => value - 1)} className="h-9 rounded-[var(--radius-ctl)] px-3 text-sm text-text-2 hover:bg-raise disabled:opacity-40">
              {t("Précédent", "Back")}
            </button>
            <button type="button" disabled={step === steps.length - 1} onClick={() => setStep((value) => value + 1)} className="h-9 rounded-[var(--radius-ctl)] bg-raise px-3 text-sm text-text hairline hover:bg-weak disabled:opacity-40">
              {t("Suivant", "Next")}
            </button>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- refusals */

function Refusals() {
  const t = useT();
  const attacks = [
    {
      id: "alone",
      title: t("Le trésorier dépense seul", "The treasurer spends alone"),
      code: "Signature must be zero for failed CHECK(MULTI)SIG",
      who: "bitcoind",
      answer: t("Le nœud Bitcoin rejette la transaction. Notre serveur n'a rien décidé.", "The Bitcoin node rejects the transaction. Our server decided nothing."),
      why: t("Le script exige deux signatures sur trois. Une seule ne vérifie pas.", "The script requires two of three signatures. One does not verify."),
      proof: "e2e · single-signature tx rejected by bitcoind",
      icon: <IconAlone />,
    },
    {
      id: "server",
      title: t("Le serveur change le destinataire", "The server swaps the recipient"),
      code: "PSBT_MISMATCH",
      who: t("téléphone de la secrétaire", "secretary's phone"),
      answer: t("Son téléphone refuse de signer. Aucune signature n'est créée.", "Her phone refuses to sign. No signature is created."),
      why: t("Le téléphone recalcule les scripts depuis les clés publiques et compare au message qu'elle a lu.", "The phone recomputes the scripts from the public keys and compares with the message she read."),
      proof: "e2e · tampered PSBT refused by approver",
      icon: <IconSwap />,
    },
    {
      id: "early",
      title: t("Récupération trop tôt", "Recovery too early"),
      code: "non-BIP68-final",
      who: "bitcoind",
      answer: t("Le nœud refuse tant que les pièces n'ont pas N confirmations.", "The node refuses until the coins have N confirmations."),
      why: t("Le chemin de secours porte un délai relatif (CSV). La démo utilise N = 10 blocs.", "The fallback path carries a relative timelock (CSV). The demo uses N = 10 blocks."),
      proof: "e2e · recovery before N rejected; after N accepted",
      icon: <IconClock />,
    },
    {
      id: "expired",
      title: t("Demande expirée", "Expired request"),
      code: "REQUEST_EXPIRED",
      who: t("téléphone + serveur", "phone + server"),
      answer: t("Personne ne peut la signer ni la diffuser après 24 heures.", "Nobody can sign or broadcast it after 24 hours."),
      why: t("Un vieux message ne doit pas libérer l'argent des semaines plus tard.", "An old message must not release money weeks later."),
      proof: "e2e · expired request cannot be signed or broadcast",
      icon: <IconHourglass />,
    },
    {
      id: "audit",
      title: t("Quelqu'un modifie l'historique", "Someone edits the history"),
      code: "audit broken at seq 1",
      who: t("vérification d'audit", "audit verify"),
      answer: t("La chaîne d'audit casse et le dit. Il n'y a pas de bouton « réparer ».", "The audit chain breaks and says so. There is no 'repair' button."),
      why: t("Chaque ligne contient l'empreinte de la précédente.", "Each row carries the hash of the previous one."),
      proof: "e2e · tampering one row makes verify fail",
      icon: <IconChain />,
    },
  ];
  const [active, setActive] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const current = attacks[active] ?? attacks[0]!;
  return (
    <Section id="refus" className="border-t border-line">
      <SectionLabel index="03" name={t("Ce que le réseau refuse", "What the network refuses")} />
      <Heading sub={t("Chaque refus ci-dessous a été produit par la suite e2e sur GitHub Actions, contre un vrai nœud Bitcoin Core en regtest.", "Each refusal below was produced by the e2e suite on GitHub Actions, against a real Bitcoin Core node on regtest.")}>
        {t("Les règles ne vivent pas dans un bouton ", "The rules don't live in a button ")}
        <em className="accent">{t("désactivé", "turned off")}</em>.
      </Heading>
      <div className="mt-12 grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div role="tablist" aria-label={t("Attaques", "Attacks")} className="flex flex-col gap-1.5">
          {attacks.map((attack, index) => (
            <button
              key={attack.id}
              role="tab"
              id={`tab-${attack.id}`}
              aria-selected={active === index}
              aria-controls="refusal-panel"
              onClick={() => {
                setActive(index);
                if (window.innerWidth < 1024) panel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }}
              className={`flex items-start gap-3 rounded-[var(--radius-card)] p-4 text-left transition-colors ${active === index ? "bg-panel hairline-strong" : "hover:bg-panel"}`}
            >
              <span className={`mt-0.5 shrink-0 ${active === index ? "text-refuse" : "text-text-3"}`}>{attack.icon}</span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-[15px] font-medium">{attack.title}</span>
                <span className="truncate font-mono text-[12px] text-text-3">{attack.code}</span>
              </span>
            </button>
          ))}
        </div>
        <div ref={panel} id="refusal-panel" role="tabpanel" aria-labelledby={`tab-${current.id}`} key={current.id} className="arrive flex flex-col gap-6 rounded-[var(--radius-card)] bg-panel p-6 hairline sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <StatePill state="REFUSE">{t("Refusé", "Refused")}</StatePill>
            <span className="text-[13px] text-text-3">{t("par", "by")} {current.who}</span>
          </div>
          <p className="break-words font-mono text-[17px] leading-relaxed text-refuse sm:text-[20px]">{current.code}</p>
          <dl className="grid gap-px overflow-hidden rounded-[var(--radius-ctl)] bg-line sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 bg-panel p-4">
              <dt className="font-mono text-[12px] uppercase tracking-[0.12em] text-text-3">{t("Ce qui se passe", "What happens")}</dt>
              <dd className="text-[15px] leading-relaxed">{current.answer}</dd>
            </div>
            <div className="flex flex-col gap-1.5 bg-panel p-4">
              <dt className="font-mono text-[12px] uppercase tracking-[0.12em] text-text-3">{t("Pourquoi", "Why")}</dt>
              <dd className="text-[15px] leading-relaxed text-text-2">{current.why}</dd>
            </div>
          </dl>
          <p className="flex flex-wrap items-center gap-2 text-[13px] text-text-3">
            {t("Prouvé par", "Proved by")} <Code tone="muted">{current.proof}</Code>
          </p>
          <ButtonLink href="/app" variant="secondary" arrow className="self-start">
            {t("Le provoquer soi-même", "Trigger it yourself")}
          </ButtonLink>
        </div>
      </div>
    </Section>
  );
}

function IconAlone() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <rect x="3" y="7" width="14" height="10" rx="3" />
      <circle cx="7.5" cy="11.5" r="1.4" fill="currentColor" />
      <circle cx="12.5" cy="11.5" r="1.4" strokeDasharray="1.5 1.5" />
      <path d="M7 7V5.5a3 3 0 0 1 6 0" />
    </svg>
  );
}
function IconSwap() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h11l-3-3M16 13H5l3 3" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l2.5 1.5" />
    </svg>
  );
}
function IconHourglass() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 3h9M5.5 17h9M6.5 3c0 4 7 4 7 7s-7 3-7 7M13.5 3c0 4-7 4-7 7" />
    </svg>
  );
}
function IconChain() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <rect x="2.5" y="7.5" width="7" height="5" rx="2.5" />
      <rect x="10.5" y="7.5" width="7" height="5" rx="2.5" />
      <path d="M9 5l2 10" />
    </svg>
  );
}

/* ---------------------------------------------------------------- status */

function Status() {
  const t = useT();
  type Mark = "live" | "sim" | "next";
  const rows: [string, Mark, string][] = [
    [t("Fonds 2-sur-3 et chemin de secours à délai", "2-of-3 fund and timelocked fallback"), "live", t("Bitcoin Core 32.1, regtest", "Bitcoin Core 32.1, regtest")],
    [t("Vérification de la transaction sur le téléphone", "Transaction check on the phone"), "live", t("Avant chaque signature", "Before every signature")],
    [t("Demandes et accords par Nostr (NIP-17)", "Requests and approvals over Nostr (NIP-17)"), "live", t("Relais de démo, sans authentification des éditeurs", "Demo relay, no publisher authentication")],
    [t("Clés chiffrées sur l'appareil", "Keys encrypted on the device"), "live", "PBKDF2 310k + AES-256-GCM"],
    [t("Journal d'audit chaîné", "Hash-chained audit log"), "live", t("Vérifiable par tout membre", "Verifiable by any member")],
    [t("Prix BTC/EUR", "BTC/EUR price"), "sim", t("Valeur fixe de démo (60 000 €), affichée comme telle", "Fixed demo value (€60,000), labelled as such")],
    [t("Trois responsables dans un seul navigateur", "Three officers in one browser"), "sim", t("Pour la démo. Un vrai fonds : une clé par téléphone", "For the demo. A real fund: one key per phone")],
    [t("Rejoindre un fonds depuis un 2ᵉ téléphone", "Join a fund from a 2nd phone"), "next", t("Invitation par QR", "QR invitation")],
    [t("Cotiser par Wave ou Orange Money", "Pay dues with Wave or Orange Money"), "next", t("Via un pont Mobile Money", "Through a Mobile Money bridge")],
    [t("Lightning, wolof, réseau principal", "Lightning, Wolof, mainnet"), "next", t("Le réseau principal attend un audit", "Mainnet waits for an audit")],
  ];
  const markLabel: Record<Mark, string> = { live: t("En ligne", "Live"), sim: t("Simulé", "Simulated"), next: t("Prochain", "Next") };
  const markState: Record<Mark, UiState> = { live: "ALLOW", sim: "PENDING", next: "UNKNOWN" };
  return (
    <Section id="statut" className="border-t border-line">
      <SectionLabel index="04" name={t("Où en est le projet", "Where it stands")} />
      <Heading sub={t("Ce qui tourne, ce qui est simulé pour la démo, et ce qui vient ensuite. Rien de simulé n'est présenté comme réel dans l'app.", "What runs, what is simulated for the demo, and what comes next. Nothing simulated is shown as real in the app.")}>
        {t("Honnête, ligne par ligne.", "Honest, line by line.")}
      </Heading>
      <div className="mt-12 overflow-hidden rounded-[var(--radius-card)] hairline">
        {rows.map(([what, mark, note]) => (
          <div key={what} className="grid gap-2 border-t border-line px-5 py-4 first:border-t-0 sm:grid-cols-[minmax(0,1.4fr)_130px_minmax(0,1fr)] sm:items-center sm:gap-4">
            <span className="text-[15px] text-text">{what}</span>
            <span>
              <StatePill state={markState[mark]}>{markLabel[mark]}</StatePill>
            </span>
            <span className="text-[14px] text-text-3">{note}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- faq */

function Faq() {
  const t = useT();
  const items: [string, string][] = [
    [
      t("Et si deux responsables s'entendent pour voler ?", "What if two officers collude to steal?"),
      t("Ils peuvent dépenser : c'est la règle choisie. Koinon empêche une personne seule, pas une majorité. Chaque dépense reste visible par tous les membres, avec son motif.", "They can spend: that is the chosen rule. Koinon stops one person, not a majority. Every spend stays visible to all members, with its purpose."),
    ],
    [
      t("Et si un responsable perd son téléphone ?", "What if an officer loses their phone?"),
      t("Les deux autres peuvent toujours dépenser. Si deux téléphones sont perdus, un responsable et la clé de l'assemblée récupèrent le fonds après un délai (environ 30 jours en réel, 10 blocs en démo).", "The two others can still spend. If two phones are lost, one officer and the assembly key recover the fund after a delay (about 30 days for real, 10 blocks in the demo)."),
    ],
    [
      t("Le serveur peut-il prendre l'argent ?", "Can the server take the money?"),
      t("Non. Il ne détient aucune clé privée. S'il modifie une transaction, le téléphone du responsable refuse de la signer.", "No. It holds no private key. If it alters a transaction, the officer's phone refuses to sign it."),
    ],
    [
      t("Pourquoi Bitcoin et pas un compte Wave partagé ?", "Why Bitcoin and not a shared Wave account?"),
      t("Un compte Wave a un seul titulaire et un seul code. Ici, la règle des deux signatures est vérifiée par le réseau lui-même, pas par une promesse.", "A Wave account has one holder and one code. Here, the two-signature rule is checked by the network itself, not by a promise."),
    ],
    [
      t("Les sats de la démo ont-ils une valeur ?", "Do the demo sats have value?"),
      t("Non. La démo tourne sur regtest, un réseau Bitcoin privé de test. Chaque écran le rappelle.", "No. The demo runs on regtest, a private Bitcoin test network. Every screen says so."),
    ],
  ];
  return (
    <Section id="faq" className="border-t border-line">
      <SectionLabel index="05" name={t("Questions", "Questions")} />
      <Heading>{t("Ce qu'un trésorier demande en premier.", "What a treasurer asks first.")}</Heading>
      <div className="mt-10 flex max-w-[820px] flex-col">
        {items.map(([question, answer]) => (
          <details key={question} className="group border-t border-line py-5 last:border-b">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-medium [&::-webkit-details-marker]:hidden">
              {question}
              <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-raise text-text-2 transition-transform duration-300 group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 max-w-[680px] text-[15px] leading-relaxed text-text-2">{answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

function Closing() {
  const t = useT();
  return (
    <Section className="border-t border-line">
      <div className="relative flex flex-col items-start gap-6 overflow-hidden rounded-[24px] bg-panel p-8 hairline sm:p-12">
        <div aria-hidden className="absolute -right-6 -top-6 flex gap-3 opacity-80">
          <Keyhole filled color="var(--color-o1)" size={96} />
          <Keyhole filled color="var(--color-brand)" size={96} />
        </div>
        <h2 className="relative max-w-[620px] text-[32px] sm:text-[44px]">
          {t("Jouez les deux responsables. ", "Play both officers. ")}
          <em className="accent">{t("Essayez de tricher.", "Try to cheat.")}</em>
        </h2>
        <p className="relative max-w-[560px] text-[16px] leading-relaxed text-text-2">
          {t(
            "La démo crée un dahira de 12 membres dans votre navigateur, avec de vraies clés et de vraies transactions regtest. Deux téléphones côte à côte : tentez de dépenser seul, puis signez à deux.",
            "The demo creates a 12-member dahira in your browser, with real keys and real regtest transactions. Two phones side by side: try to spend alone, then sign together.",
          )}
        </p>
        <div className="relative flex flex-wrap gap-3">
          <ButtonLink href="/app" size="lg" arrow>
            {t("Ouvrir l'app", "Open the app")}
          </ButtonLink>
          <ButtonLink href={REPO_URL} external variant="secondary" size="lg">
            {t("Lire le code", "Read the code")}
          </ButtonLink>
        </div>
      </div>
    </Section>
  );
}
