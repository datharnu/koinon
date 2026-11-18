import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PEOPLE } from "../lib/people";
import { usePrefs, useT } from "../lib/prefs";
import { Avatar, Chip } from "../ui/avatar";
import { ButtonLink } from "../ui/button";
import { IconArrowRight, IconCheck, IconClock, IconX, Logo } from "../ui/icons";
import { LangPill, LangToggle, ThemeToggle } from "../ui/toggles";
import { REPO_URL, SiteFooter } from "../ui/site";

/** From the regtest demo at the 60,000 EUR fixture. Example, not a market price. */
const REQUEST_XOF = 15_000;
// This used to be 15 × 2,541 = 38,115 sats. The app converts the whole amount at the rate and
// rounds once, so the same request locks 38,113 sats. Copy the app's number; do not multiply.
const requestSats = 38_113;

const FINDEX = "https://microdata.worldbank.org/catalog/7971/variable/F1/V64?name=fin17c";
const EFA = "https://efa.africa/etude-tontine-en-chiffres";
const BCEAO =
  "https://www.bceao.int/sites/default/files/2026-03/Rapport%20annuel%20sur%20les%20services%20financiers%20num%C3%A9riques%20dans%20l%27UEMOA%20-%202024.pdf";
const CALEBASSE = "https://www.leral.net/Plus-de-2-500-calebasses-de-solidarite-denombrees-a-travers-le-pays_a377683.html";

export function Home() {
  const t = useT();
  useEffect(() => {
    document.title = t("Koinon · la caisse à deux clés", "Koinon · the two-key fund");
  }, [t]);
  return (
    <>
      <HomeNav />
      <main>
        <Hero />
        <Problem />
        <Questions />
        <Proof />
        <Limits />
        <Closing />
      </main>
      <SiteFooter />
    </>
  );
}

function num(value: number, lang: "fr" | "en"): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US").format(value);
}

function useNum() {
  const { lang } = usePrefs();
  return (value: number) => num(value, lang);
}

function HomeNav() {
  const t = useT();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const items = [
    { href: "#probleme", label: t("Le problème", "The problem") },
    { href: "#questions", label: t("Comment ça marche", "How it works") },
    { href: "#preuve", label: t("La preuve", "The proof") },
    { href: "#limites", label: t("Limites", "Limits") },
  ];
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color] duration-200 ${
        scrolled || open ? "border-line bg-surface/95 backdrop-blur-xl" : "border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 w-full max-w-[1120px] items-center gap-2 px-4 sm:px-5">
        <a href="#top" aria-label={t("Accueil Koinon", "Koinon home")} className="shrink-0">
          <Logo withName />
        </a>
        <div className="mx-auto hidden items-center gap-0.5 lg:flex">
          {items.map((item) => (
            <a key={item.href} href={item.href} className="rounded-full px-3.5 py-2 text-[14px] font-medium text-ink-2 transition-colors hover:bg-card hover:text-ink">
              {item.label}
            </a>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <span className="max-sm:hidden">
            <LangToggle />
          </span>
          <span className="sm:hidden">
            <LangPill />
          </span>
          <ThemeToggle />
          <ButtonLink href="/app" size="sm" className="ml-0.5 max-[370px]:px-3">
            {t("Ouvrir l'app", "Open the app")}
          </ButtonLink>
          <button
            ref={buttonRef}
            type="button"
            className="grid size-10 shrink-0 place-items-center rounded-full text-ink hover:bg-card lg:hidden"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="sr-only">{open ? t("Fermer le menu", "Close the menu") : t("Ouvrir le menu", "Open the menu")}</span>
            {open ? <IconX size={18} /> : <MenuMark />}
          </button>
        </div>
      </nav>
      {open ? (
        <div id={menuId} className="border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="mb-2 sm:hidden">
            <LangToggle />
          </div>
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex min-h-11 items-center rounded-xl px-2 text-[15.5px] font-medium text-ink hover:bg-card"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
        </div>
      ) : null}
    </header>
  );
}

function MenuMark() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M2 3.5h14M2 10.5h14" />
    </svg>
  );
}

function Section({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`mx-auto w-full max-w-[1120px] scroll-mt-20 px-4 py-16 sm:px-5 sm:py-24 ${className}`}>
      {children}
    </section>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-brand">{children}</p>;
}

function Title({ children }: { children: ReactNode }) {
  return <h2 className="mt-3 max-w-[20ch] text-[32px] font-extrabold leading-[1.06] tracking-[-0.03em] sm:text-[46px]">{children}</h2>;
}

/* ---------- Hero: one claim, one real screen ---------- */

function Hero() {
  const t = useT();
  return (
    <section id="top" className="home-rise relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(60%_60%_at_70%_30%,color-mix(in_oklab,var(--color-brand)_14%,transparent),transparent)]" />
      <div className="relative mx-auto grid w-full max-w-[1120px] items-center gap-12 px-4 pb-16 pt-28 sm:px-5 sm:pt-36 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:pb-24">
        <div>
          <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-[#F7931A]" />
              Bitcoin
            </span>
            <span aria-hidden className="text-ink-3">·</span>
            <span>{t("2 clés sur 3", "2 keys of 3")}</span>
            <span aria-hidden className="text-ink-3">·</span>
            <span>{t("en francs CFA", "in CFA francs")}</span>
          </p>
          <h1 className="mt-5 max-w-[13ch] text-[44px] font-extrabold leading-[1] tracking-[-0.04em] sm:text-[68px]">
            {t("Personne ne vide la caisse ", "Nobody empties the fund ")}
            <span className="text-brand">{t("seul.", "alone.")}</span>
          </h1>
          <p className="mt-6 max-w-[46ch] text-[17.5px] leading-relaxed text-ink-2">
            {t(
              "Koinon garde la caisse de votre association sur Bitcoin. Chaque dépense demande deux responsables sur trois. Le trésorier ne peut rien sortir seul, Koinon non plus, et chaque membre voit sur son téléphone qui a signé.",
              "Koinon keeps your association's fund on Bitcoin. Every spend needs two of three officers. The treasurer cannot take anything alone, neither can Koinon, and every member sees on their phone who signed.",
            )}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/app" size="lg" className="group">
              {t("Essayer la démo", "Try the demo")}
              <IconArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
            </ButtonLink>
            <ButtonLink href="#preuve" variant="secondary" size="lg" className="ring-1 ring-line">
              {t("Voir le refus", "See the refusal")}
            </ButtonLink>
          </div>
          <p className="mt-6 max-w-[52ch] text-[13px] leading-relaxed text-ink-3">
            {t(
              "Démo sur regtest : de vraies transactions Bitcoin, des sats sans valeur. Pas sur le réseau principal, pas audité.",
              "Demo on regtest: real Bitcoin transactions, sats with no value. Not on mainnet, not audited.",
            )}
          </p>
        </div>
        <HeroPhone />
      </div>
    </section>
  );
}

/** A real capture of Ibou's home screen in /app, one per language and theme. */
function HeroPhone() {
  const { t, lang, theme } = usePrefs();
  return (
    <figure className="mx-auto w-full max-w-[330px] lg:mr-4">
      <div className="hero-stage">
        <div className="hero-device">
          <div className="relative overflow-hidden rounded-[40px] bg-surface">
            <img
              src={`/hero/home-${lang}-${theme}.webp`}
              width={716}
              height={1304}
              alt={t(
                "Écran d'accueil de Koinon : 60 000 F dans la caisse de l'association, boutons Dépenser et Inviter, cotisations de 5 000 F.",
                "Koinon home screen: 60,000 F in the association's fund, Spend and Invite buttons, 5,000 F dues.",
              )}
              fetchPriority="high"
              decoding="async"
              className="block h-auto w-full"
            />
            <span aria-hidden className="hero-glare" />
          </div>
        </div>
      </div>
    </figure>
  );
}

/* ---------- Problem: three sourced numbers, each with its limit ---------- */

function Problem() {
  const t = useT();
  const stats = [
    {
      value: t("57,4 %", "57.4%"),
      label: t("des femmes au Sénégal épargnent en groupe (2024).", "of women in Senegal save in a group (2024)."),
      limit: t("Mesure plus large qu'une tontine. Adultes : 43,5 %.", "Wider than a tontine. All adults: 43.5%."),
      source: [
        ["efa.africa", EFA],
        ["Findex FIN17C", FINDEX],
      ],
    },
    {
      value: t("> 2 500", "> 2,500"),
      label: t("calebasses de solidarité, plus de 80 000 membres, 95 % de femmes.", "solidarity funds, over 80,000 members, 95% women."),
      limit: t("Chiffre du ministre (APS, 19 fév. 2025), pas un recensement.", "The minister's figure (APS, 19 Feb 2025), not a census."),
      source: [["leral.net · APS", CALEBASSE]],
    },
    {
      value: t("24,1 %", "24.1%"),
      label: t("du volume de monnaie électronique de l'UEMOA passe au Sénégal (2024).", "of UEMOA e-money volume is in Senegal (2024)."),
      limit: t("Un compte mobile a un seul titulaire. Pas l'argent des associations.", "A mobile account has one holder. Not association money."),
      source: [["BCEAO §59", BCEAO]],
    },
  ] as const;
  return (
    <Section id="probleme" className="sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <div>
          <Kicker>{t("Le problème", "The problem")}</Kicker>
          <Title>{t("L'argent du groupe tient dans une seule main.", "The group's money sits in one pair of hands.")}</Title>
          <p className="mt-5 max-w-[44ch] text-[16px] leading-relaxed text-ink-2">
            {t(
              "Dahiras, tontines, GIE : la caisse est souvent chez le trésorier, ou sur son compte Wave. Les membres doivent le croire sur parole.",
              "Dahiras, tontines, GIEs: the fund often sits with the treasurer, or on his Wave account. Members have to take his word for it.",
            )}
          </p>
        </div>
        <ul className="grid gap-px overflow-hidden rounded-[28px] bg-line ring-1 ring-line sm:grid-cols-3 lg:grid-cols-1">
          {stats.map((stat) => (
            <li key={stat.value} className="flex flex-col bg-surface p-6 lg:grid lg:grid-cols-[10.5rem_minmax(0,1fr)] lg:items-baseline lg:gap-6">
              <p className="tabular whitespace-nowrap text-[36px] font-extrabold sm:text-[30px] lg:text-[38px] leading-none tracking-[-0.035em] text-brand">{stat.value}</p>
              <div className="mt-3 lg:mt-0">
                <p className="text-[16px] font-semibold leading-snug">{stat.label}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
                  {stat.limit}{" "}
                  {stat.source.map(([label, href], index) => (
                    <span key={href}>
                      {index > 0 ? " · " : null}
                      <a className="font-semibold text-ink-2 underline underline-offset-2 hover:text-ink" href={href} target="_blank" rel="noreferrer">
                        {label}
                      </a>
                    </span>
                  ))}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/* ---------- Three questions a member asks ---------- */

function Questions() {
  const t = useT();
  return (
    <Section id="questions">
      <Kicker>{t("Comment ça marche", "How it works")}</Kicker>
      <Title>{t("Les trois questions que pose chaque membre.", "The three questions every member asks.")}</Title>
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <QuestionCard
          question={t("Le trésorier peut-il partir avec la caisse ?", "Can the treasurer walk off with the fund?")}
          answer={t("Non.", "No.")}
          body={t(
            "Trois responsables ont chacun une clé sur leur téléphone. Une dépense en demande deux. Avec une seule signature, Bitcoin refuse la transaction.",
            "Three officers each hold a key on their phone. A spend needs two. With one signature, Bitcoin rejects the transaction.",
          )}
          limit={t("Prouvé sur regtest : une signature donne NULLFAIL.", "Proved on regtest: one signature gives NULLFAIL.")}
          visual={<KeysVisual />}
        />
        <QuestionCard
          question={t("Koinon peut-il prendre l'argent ?", "Can Koinon take the money?")}
          answer={t("Non.", "No.")}
          body={t(
            "Le serveur n'a aucune clé. Il prépare la transaction ; le téléphone la relit et refuse de signer si le destinataire ou le montant a changé.",
            "The server holds no key. It prepares the transaction; the phone re-reads it and refuses to sign if the recipient or amount changed.",
          )}
          limit={t("Il peut encore mentir sur le nombre de confirmations affiché.", "It can still lie about the confirmation count on screen.")}
          visual={<ServerVisual />}
        />
        <QuestionCard
          question={t("Et si un responsable disparaît ?", "What if an officer disappears?")}
          answer={t("La caisse reste ouverte.", "The fund stays open.")}
          body={t(
            "Avec deux responsables, rien ne change. S'il n'en reste qu'un, lui et la clé de l'assemblée peuvent dépenser, mais seulement après un délai écrit dans le script.",
            "With two officers left, nothing changes. If only one is left, they and the assembly key can spend, but only after a delay written into the script.",
          )}
          limit={t("10 blocs en démo. Le délai réel (~30 jours) n'a pas été testé.", "10 blocks in the demo. The real delay (~30 days) was not tested.")}
          visual={<DelayVisual />}
        />
      </div>
      <div className="mt-4 flex flex-col gap-2 rounded-[24px] bg-card px-6 py-5 sm:flex-row sm:items-center sm:gap-5">
        <p className="shrink-0 text-[15px] font-bold">{t("Et deux responsables d'accord ?", "And two officers who agree?")}</p>
        <p className="text-[14.5px] leading-relaxed text-ink-2">
          {t(
            "Ils peuvent dépenser : c'est la règle. Koinon empêche une personne seule, pas un accord à deux. Chaque membre voit leurs deux noms.",
            "They can spend: that is the rule. Koinon stops one person, not two who agree. Every member sees both their names.",
          )}
        </p>
      </div>
    </Section>
  );
}

function QuestionCard({ question, answer, body, limit, visual }: { question: string; answer: string; body: string; limit: string; visual: ReactNode }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-[28px] bg-surface ring-1 ring-line">
      <div className="grid h-40 place-items-center bg-card/60">{visual}</div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-[18px] font-bold leading-snug tracking-[-0.01em] lg:min-h-[2.75em]">{question}</h3>
        <p className="mt-3 text-[28px] font-extrabold leading-none tracking-[-0.03em] text-brand">{answer}</p>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">{body}</p>
        <div className="mt-auto pt-5">
          <p className="border-t border-line pt-3.5 text-[12.5px] leading-relaxed text-ink-3">{limit}</p>
        </div>
      </div>
    </article>
  );
}

function KeysVisual() {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3" aria-hidden>
      <div className="flex items-center gap-2">
        {(["O1", "O2", "O3"] as const).map((role) => {
          const person = PEOPLE[role];
          const signed = role !== "O3";
          return (
            <span key={role} className={`relative ${signed ? "" : "opacity-45"}`}>
              <Avatar name={person.name} tone={person.tone} size={48} ring />
              {signed ? (
                <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-good text-white ring-2 ring-surface">
                  <IconCheck size={11} />
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
      <span className="font-mono text-[12.5px] font-semibold text-ink-2">2 / 3 {t("signatures", "signatures")}</span>
    </div>
  );
}

function ServerVisual() {
  const t = useT();
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="grid h-20 w-16 place-items-center rounded-2xl bg-surface ring-1 ring-line">
        <span className="flex flex-col gap-1.5">
          <span className="h-1.5 w-8 rounded-full bg-ink-3/40" />
          <span className="h-1.5 w-8 rounded-full bg-ink-3/40" />
          <span className="h-1.5 w-8 rounded-full bg-ink-3/40" />
        </span>
      </span>
      <span className="flex flex-col items-start gap-1.5">
        <span className="font-mono text-[12.5px] font-semibold text-ink-2">{t("serveur", "server")}</span>
        <Chip tone="bad">{t("0 clé", "0 keys")}</Chip>
      </span>
    </div>
  );
}

function DelayVisual() {
  const t = useT();
  return (
    <div className="w-[78%] max-w-[260px]" aria-hidden>
      <div className="flex items-center justify-between text-[12px] font-semibold text-ink-2">
        <span>{t("Départ", "Start")}</span>
        <span className="inline-flex items-center gap-1">
          <IconClock size={13} />
          {t("délai", "delay")}
        </span>
      </div>
      <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-card-2">
        <span className="block h-full w-[68%] rounded-full bg-[repeating-linear-gradient(135deg,var(--color-ink-3)_0_4px,transparent_4px_8px)] opacity-40" />
        <span className="ml-1 block h-full flex-1 rounded-full bg-brand" />
      </div>
      <div className="mt-2 flex items-center justify-between text-[12px]">
        <span className="text-ink-3">{t("verrouillé", "locked")}</span>
        <span className="font-semibold text-brand">{t("assemblée + 1", "assembly + 1")}</span>
      </div>
    </div>
  );
}

/* ---------- Proof: one live refusal, the rest listed ---------- */

function Proof() {
  const t = useT();
  const n = useNum();
  const [sigs, setSigs] = useState<1 | 2>(1);
  const refused = sigs === 1;
  const others: [string, string, string][] = [
    ["PSBT_MISMATCH", t("Destinataire changé après la demande : le téléphone ne signe pas.", "Recipient changed after the request: the phone does not sign."), "core/test/verify.test.ts"],
    ["FEE_OVER_CAP", t("Frais au-dessus du plafond : refusé avant la signature.", "Fee above the cap: refused before signing."), "core/test/verify.test.ts"],
    ["non-BIP68-final", t("Secours avant la fin du délai : bitcoind refuse.", "Recovery before the delay ends: bitcoind refuses."), "pnpm kill-test"],
    ["REQUEST_EXPIRED", t("Demande de plus de 24 h : ni signée, ni diffusée.", "Request older than 24 h: not signed, not broadcast."), "coordinator/test/api.test.ts"],
    [t("chaîne cassée", "chain broken"), t("Une ligne d'historique modifiée : le téléphone s'arrête dessus.", "One history row edited: the phone stops at it."), "core/test/proof.test.ts"],
  ];
  return (
    <Section id="preuve">
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
        <div>
          <Kicker>{t("La preuve", "The proof")}</Kicker>
          <Title>{t("Essayez avec une seule signature.", "Try it with one signature.")}</Title>
          <p className="mt-5 max-w-[46ch] text-[16px] leading-relaxed text-ink-2">
            {t(
              "Le refus ne vient pas d'un bouton grisé. C'est Bitcoin qui rejette la transaction. Dans la démo, vous pouvez le provoquer vous-même.",
              "The refusal is not a greyed-out button. Bitcoin itself rejects the transaction. In the demo, you can trigger it yourself.",
            )}
          </p>

          <div className="mt-8 rounded-[28px] bg-surface p-5 shadow-[0_24px_60px_-34px_rgb(20_14_60/0.3)] ring-1 ring-line sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold">{t("Location de salle", "Hall rental")}</p>
                <p className="tabular mt-0.5 font-mono text-[12.5px] text-ink-2">
                  {n(REQUEST_XOF)} F · {n(requestSats)} sats
                </p>
              </div>
              <Chip tone={refused ? "bad" : "good"} dot>
                {refused ? "REFUSE" : "ALLOW"}
              </Chip>
            </div>
            <label className="mt-5 block">
              <span className="flex items-baseline justify-between gap-2 text-[13px] font-semibold text-ink-2">
                <span>{t("Signatures", "Signatures")}</span>
                <span className="font-mono text-ink">{sigs} / 2</span>
              </span>
              <input
                className="home-range mt-2.5"
                style={{ ["--home-fill" as string]: refused ? "0%" : "100%" }}
                type="range"
                min={1}
                max={2}
                step={1}
                value={sigs}
                aria-valuetext={refused ? t("1 signature, Bitcoin refuse", "1 signature, Bitcoin refuses") : t("2 signatures, Bitcoin accepte", "2 signatures, Bitcoin accepts")}
                onChange={(event) => setSigs(Number(event.target.value) === 1 ? 1 : 2)}
              />
            </label>
            <div
              aria-live="polite"
              className={`mt-4 rounded-2xl p-4 ring-1 transition-colors ${refused ? "bg-bad-soft/60 ring-bad/30" : "bg-good-soft/60 ring-good/30"}`}
            >
              <p className={`font-mono text-[13px] font-bold ${refused ? "text-bad" : "text-good"}`}>{refused ? "NULLFAIL" : "ALLOW · 2-of-3"}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink">
                {refused
                  ? t("Seul Ibou a signé. bitcoind rejette la dépense ; le serveur n'a rien décidé.", "Only Ibou signed. bitcoind rejects the spend; the server decided nothing.")
                  : t("Ibou et Coumba ont signé. Les deux clés se lisent dans la transaction.", "Ibou and Coumba signed. Both keys can be read in the transaction.")}
              </p>
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-ink-3">
              {t(
                "Ce curseur est une illustration et n'appelle pas de nœud. Résultats enregistrés sur regtest le 17 nov. 2026 : NULLFAIL (pnpm kill-test) et tx 9f9144009c77…1728.",
                "This slider is an illustration and calls no node. Recorded on regtest on 17 Nov 2026: NULLFAIL (pnpm kill-test) and tx 9f9144009c77…1728.",
              )}
            </p>
          </div>
        </div>

        <div className="lg:pt-[7.5rem]">
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-3">{t("Les autres refus, testés", "The other refusals, tested")}</p>
          <ul className="mt-3 overflow-hidden rounded-[24px] bg-surface ring-1 ring-line">
            {others.map(([code, line, test]) => (
              <li key={code} className="border-t border-line px-5 py-4 first:border-t-0">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="font-mono text-[12.5px] font-bold text-bad">{code}</span>
                  <span className="break-all font-mono text-[11.5px] text-ink-3">{test}</span>
                </div>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{line}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

/* ---------- Limits and what this is not ---------- */

function Limits() {
  const t = useT();
  type MarkKind = "live" | "sim" | "next";
  const rows: [string, MarkKind, string][] = [
    [t("Caisse 2-sur-3 et secours à délai", "2-of-3 fund and delayed recovery"), "live", t("Bitcoin Core 32.1, regtest", "Bitcoin Core 32.1, regtest")],
    [t("Vérification sur le téléphone avant de signer", "Check on the phone before signing"), "live", "PSBT_MISMATCH · FEE_OVER_CAP"],
    [t("Demandes chiffrées (Nostr NIP-17)", "Encrypted requests (Nostr NIP-17)"), "live", t("Relais de démo, sans authentification", "Demo relay, no authentication")],
    [t("Clés chiffrées sur l'appareil", "Keys encrypted on the device"), "live", t("Passkey, ou un code à 8 chiffres", "Passkey, or an 8-digit code")],
    [t("Historique relu sur le téléphone", "History rechecked on the phone"), "live", t("Une chaîne réécrite depuis le début peut correspondre", "A chain rewritten from the start can match")],
    [t("Prix BTC/EUR", "BTC/EUR price"), "sim", t("Figé à 60 000, affiché comme tel", "Fixed at 60,000, labelled as such")],
    [t("Trois responsables dans un navigateur", "Three officers in one browser"), "sim", t("La démo. Un vrai fonds : une clé par téléphone", "The demo. A real fund: one key per phone")],
    [t("Cotiser par Wave ou Orange Money", "Pay dues with Wave or Orange Money"), "next", t("Un pont, pas dans ce dépôt", "A bridge, not in this repo")],
    [t("Réseau principal", "Mainnet"), "next", t("Attend un audit", "Waits for an audit")],
  ];
  const mark: Record<MarkKind, { label: string; tone: "good" | "warn" | "neutral" }> = {
    live: { label: t("Réel", "Live"), tone: "good" },
    sim: { label: t("Simulé", "Simulated"), tone: "warn" },
    next: { label: t("Ensuite", "Next"), tone: "neutral" },
  };
  const not: [string, string][] = [
    [t("Pas un compte Wave partagé", "Not a shared Wave account"), t("Un compte a un titulaire. Ici, deux clés signent.", "An account has one holder. Here, two keys sign.")],
    [t("Pas un serveur qui approuve", "Not a server that approves"), t("Il construit la transaction, il ne la valide pas.", "It builds the transaction, it does not approve it.")],
    [t("Pas Lightning", "Not Lightning"), t("La caisse doit rester des mois dans le script.", "The fund is meant to sit for months in the script.")],
    [t("Pas d'assistant IA, pas de wolof", "No AI assistant, no Wolof"), t("Interface en français et en anglais.", "Interface in French and English.")],
  ];
  return (
    <Section id="limites">
      <Kicker>{t("Limites", "Limits")}</Kicker>
      <Title>{t("Ce qui marche, et où ça s'arrête.", "What works, and where it stops.")}</Title>
      <div className="mt-10 grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <div className="overflow-hidden rounded-[24px] bg-surface ring-1 ring-line">
          <div className="hidden grid-cols-[minmax(0,1.2fr)_7rem_minmax(0,1fr)] bg-card/60 px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3 sm:grid">
            <span>{t("Quoi", "What")}</span>
            <span>{t("État", "State")}</span>
            <span>{t("Limite", "Limit")}</span>
          </div>
          {rows.map(([what, kind, note]) => (
            <div key={what} className="grid gap-1.5 border-t border-line px-5 py-3.5 first:border-t-0 sm:grid-cols-[minmax(0,1.2fr)_7rem_minmax(0,1fr)] sm:items-center sm:gap-3 sm:first:border-t">
              <span className="text-[15px] font-semibold">{what}</span>
              <span>
                <Chip tone={mark[kind].tone} dot>
                  {mark[kind].label}
                </Chip>
              </span>
              <span className="text-[13.5px] text-ink-2">{note}</span>
            </div>
          ))}
        </div>
        <div className="rounded-[24px] bg-card p-6">
          <p className="text-[15px] font-bold">{t("Ce que Koinon n'est pas", "What Koinon is not")}</p>
          <ul className="mt-4 flex flex-col gap-4">
            {not.map(([title, body]) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-bad-soft text-bad" aria-hidden>
                  <IconX size={12} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-semibold">{title}</span>
                  <span className="mt-0.5 block text-[13.5px] leading-relaxed text-ink-2">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

function Closing() {
  const t = useT();
  return (
    <section className="px-4 pb-16 sm:px-5">
      <div className="relative mx-auto max-w-[1120px] overflow-hidden rounded-[32px] bg-brand px-6 py-14 text-on-brand sm:px-12 sm:py-20">
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-14 opacity-20">
          <Logo size={260} withName={false} />
        </div>
        <h2 className="relative max-w-[16ch] text-[34px] font-extrabold leading-[1.04] tracking-[-0.03em] sm:text-[50px]">
          {t("Jouez les deux responsables. Essayez de tricher.", "Play both officers. Try to cheat.")}
        </h2>
        <p className="relative mt-4 max-w-[50ch] text-[16.5px] leading-relaxed text-white/85">
          {t(
            "Deux minutes dans le navigateur. La démo crée un dahira avec de vraies clés et de vraies transactions regtest. Les sats n'ont aucune valeur.",
            "Two minutes in the browser. The demo creates a dahira with real keys and real regtest transactions. The sats have no value.",
          )}
        </p>
        <div className="relative mt-8 flex flex-wrap gap-3">
          <a href="/app" className="press inline-flex h-13 items-center gap-2 rounded-full bg-white px-7 text-[15.5px] font-semibold text-[#111113] hover:bg-white/90">
            {t("Essayer la démo", "Try the demo")}
            <IconArrowRight size={18} />
          </a>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="press inline-flex h-13 items-center rounded-full bg-white/15 px-7 text-[15.5px] font-semibold hover:bg-white/20">
            {t("Lire le code", "Read the code")}
          </a>
        </div>
      </div>
    </section>
  );
}
