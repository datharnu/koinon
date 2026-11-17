import { useEffect, type ReactNode } from "react";
import { PEOPLE } from "../lib/people";
import { usePrefs, useT } from "../lib/prefs";
import { Avatar, Chip } from "../ui/avatar";
import { ButtonLink } from "../ui/button";
import { IconArrowRight, IconCheck, IconChevronDown, IconClock, IconEye, IconLifebuoy, IconSend, IconShield, IconUserPlus, IconUsers, Logo } from "../ui/icons";
import { REPO_URL, SiteFooter, SiteNav } from "../ui/site";

export function Home() {
  const t = useT();
  useEffect(() => {
    document.title = t("Koinon · la caisse à deux clés", "Koinon · the two-key fund");
  }, [t]);
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <Problem />
        <Features />
        <HowItWorks />
        <Refusals />
        <Status />
        <Faq />
        <Closing />
      </main>
      <SiteFooter />
    </>
  );
}

function Section({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`mx-auto w-full max-w-[1160px] scroll-mt-24 px-5 py-20 sm:py-28 ${className}`}>
      {children}
    </section>
  );
}

function Heading({ eyebrow, title, sub, center }: { eyebrow: string; title: ReactNode; sub?: string; center?: boolean }) {
  return (
    <div className={`flex max-w-[720px] flex-col gap-4 ${center ? "mx-auto items-center text-center" : ""}`}>
      <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-brand">{eyebrow}</span>
      <h2 className="text-[34px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[46px]">{title}</h2>
      {sub ? <p className="text-[17px] leading-relaxed text-ink-2">{sub}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- hero */

function Hero() {
  const t = useT();
  return (
    <section className="relative overflow-hidden pt-32 sm:pt-40">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[900px] bg-[radial-gradient(60%_50%_at_50%_62%,color-mix(in_srgb,var(--color-brand)_22%,transparent),transparent_70%)]" />
      <div className="relative mx-auto flex max-w-[1160px] flex-col items-center px-5 text-center">
        <span className="fade-up inline-flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3.5 text-[13px] font-medium text-ink-2 shadow-[0_4px_16px_-8px_rgb(0_0_0/0.2)] ring-1 ring-line">
          <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[12px] font-bold text-brand-ink">Dakar Bitcoin Hack 2026</span>
          {t("Démo regtest en ligne", "Live regtest demo")}
        </span>
        <h1 className="fade-up mt-6 max-w-[880px] text-[44px] font-bold leading-[1.02] tracking-[-0.04em] [animation-delay:60ms] sm:text-[72px]">
          {t("La caisse de l'association s'ouvre avec ", "The association's fund opens with ")}
          <span className="text-brand">{t("deux clés.", "two keys.")}</span>
        </h1>
        <p className="fade-up mt-6 max-w-[620px] text-[18px] leading-relaxed text-ink-2 [animation-delay:120ms]">
          {t(
            "Un fonds Bitcoin partagé pour un dahira, un GIE ou un club. Le trésorier ne peut pas dépenser seul : deux responsables sur trois signent depuis leur téléphone, et chaque membre voit chaque franc.",
            "A shared Bitcoin fund for a dahira, a GIE or a club. The treasurer cannot spend alone: two of three officers sign from their phone, and every member sees every franc.",
          )}
        </p>
        <div className="fade-up mt-8 flex flex-wrap items-center justify-center gap-3 [animation-delay:180ms]">
          <ButtonLink href="/app" size="lg">
            {t("Ouvrir l'app", "Open the app")}
            <IconArrowRight size={18} />
          </ButtonLink>
          <ButtonLink href="#refus" variant="secondary" size="lg" className="bg-surface ring-1 ring-line">
            {t("Voir ce que Bitcoin refuse", "See what Bitcoin refuses")}
          </ButtonLink>
        </div>

        <div className="relative mt-16 flex h-[520px] w-full justify-center sm:mt-20 sm:h-[600px]">
          <div className="absolute left-1/2 top-6 hidden -translate-x-[96%] -rotate-[7deg] sm:block">
            <MockPhone>
              <MockHome />
            </MockPhone>
          </div>
          <div className="absolute left-1/2 top-0 -translate-x-1/2 sm:translate-x-[-4%] sm:rotate-[5deg]">
            <MockPhone>
              <MockApprove />
            </MockPhone>
          </div>
        </div>
      </div>
      <div className="relative -mt-24 border-y border-line bg-surface">
        <dl className="mx-auto grid max-w-[1160px] grid-cols-1 divide-y divide-line px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            ["2 / 3", t("signatures pour chaque dépense", "signatures for every spend")],
            ["0", t("clé privée sur le serveur", "private keys on the server")],
            ["9 / 9", t("vérifications e2e en CI, sur Bitcoin Core", "e2e checks in CI, on Bitcoin Core")],
          ].map(([value, label]) => (
            <div key={label} className="flex items-baseline gap-3 py-6 sm:justify-center sm:px-6">
              <dt className="tabular text-[30px] font-bold tracking-[-0.03em]">{value}</dt>
              <dd className="text-[14.5px] text-ink-2">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function MockPhone({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden className="pointer-events-none flex h-[600px] w-[296px] select-none flex-col overflow-hidden rounded-[42px] bg-surface text-left shadow-[0_0_0_1px_var(--color-line),0_50px_90px_-36px_rgb(20_14_60/0.45)]">
      {children}
    </div>
  );
}

function MockRow({ avatar, title, sub, right, tone }: { avatar: ReactNode; title: string; sub: string; right: string; tone?: "good" }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 [&+&]:border-t [&+&]:border-line">
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">{title}</p>
        <p className="truncate text-[11px] text-ink-3">{sub}</p>
      </div>
      <span className={`tabular text-[13px] font-semibold ${tone === "good" ? "text-good" : ""}`}>{right}</span>
    </div>
  );
}

function grouped(value: string, lang: "fr" | "en"): string {
  return lang === "fr" ? value.replace(",", "\u00a0") : value;
}

function MockHome() {
  const { t, lang } = usePrefs();
  const f = (value: string) => grouped(value, lang);
  return (
    <>
      <div className="rounded-b-[28px] bg-brand-soft px-4 pb-5 pt-5">
        <div className="flex items-center gap-2.5">
          <Avatar name={PEOPLE.O1.name} tone={PEOPLE.O1.tone} size={34} ring />
          <div>
            <p className="text-[13px] font-bold">{t("Bonjour, Ibou", "Hi, Ibou")}</p>
            <p className="text-[11px] text-ink-2">{t("Trésorier", "Treasurer")}</p>
          </div>
        </div>
        <p className="mt-5 text-[11px] font-semibold text-brand-ink">Dahira Kolda</p>
        <p className="tabular text-[36px] font-bold leading-tight tracking-[-0.035em]">{f("60,000")} F</p>
        <p className="tabular text-[11.5px] text-ink-2">{f("152,450")} sats</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <span className="flex h-10 items-center justify-center gap-1.5 rounded-full bg-brand text-[13px] font-semibold text-on-brand">
            <IconSend size={15} />
            {t("Dépenser", "Spend")}
          </span>
          <span className="flex h-10 items-center justify-center gap-1.5 rounded-full bg-ink text-[13px] font-semibold text-surface">
            <IconUserPlus size={15} />
            {t("Inviter", "Invite")}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-3 px-3 pt-4">
        <p className="px-1 text-[11.5px] font-semibold text-ink-2">{t("Activité", "Activity")}</p>
        <div className="overflow-hidden rounded-[18px] bg-card">
          <MockRow avatar={<Avatar name="Awa" tone="amber" size={30} />} title="Awa" sub={t("6 confirmations", "6 confirmations")} right={`+${f("5,000")} F`} tone="good" />
          <MockRow avatar={<Avatar name="Moussa" tone="sky" size={30} />} title="Moussa" sub={t("6 confirmations", "6 confirmations")} right={`+${f("5,000")} F`} tone="good" />
          <MockRow avatar={<Avatar name="Fatou" tone="rose" size={30} />} title="Fatou" sub={t("6 confirmations", "6 confirmations")} right={`+${f("5,000")} F`} tone="good" />
          <MockRow avatar={<Avatar name="Ibrahima" tone="good" size={30} />} title="Ibrahima" sub={t("6 confirmations", "6 confirmations")} right={`+${f("5,000")} F`} tone="good" />
        </div>
      </div>
    </>
  );
}

function MockApprove() {
  const { t, lang } = usePrefs();
  const f = (value: string) => grouped(value, lang);
  return (
    <>
      <p className="px-5 pb-2 pt-5 text-[15px] font-bold">{t("Demande", "Request")}</p>
      <div className="flex flex-col items-center px-5 pb-4 text-center">
        <Avatar name={PEOPLE.O1.name} tone={PEOPLE.O1.tone} size={42} />
        <p className="mt-2 text-[12px] text-ink-2">{t("Ibou demande", "Ibou is requesting")}</p>
        <p className="tabular text-[34px] font-bold leading-tight tracking-[-0.03em]">{f("15,000")} F</p>
        <p className="tabular text-[11px] text-ink-3">{f("38,112")} sats · {t("taux figé", "rate locked")}</p>
        <p className="mt-2 text-[13px]">« {t("Transport pour le Magal", "Transport for the Magal")} »</p>
        <Chip tone="brand" dot className="mt-2 h-5 text-[11px]">
          {t("À signer", "To sign")}
        </Chip>
      </div>
      <div className="px-3">
        <p className="px-1 pb-1.5 text-[11.5px] font-semibold text-ink-2">{t("Signatures", "Signatures")}</p>
        <div className="overflow-hidden rounded-[18px] bg-card">
          {(["O1", "O2", "O3"] as const).map((role) => (
            <div key={role} className="flex items-center gap-2.5 px-3.5 py-2.5 [&+&]:border-t [&+&]:border-line">
              <Avatar name={PEOPLE[role].name} tone={PEOPLE[role].tone} size={28} />
              <span className="flex-1 text-[12.5px] font-semibold">
                {PEOPLE[role].name}
                {role === "O2" ? <span className="font-normal text-ink-3"> ({t("vous", "you")})</span> : null}
              </span>
              {role === "O1" ? (
                <span className="grid size-5 place-items-center rounded-full bg-good text-white">
                  <IconCheck size={12} />
                </span>
              ) : (
                <span className="text-[11.5px] text-ink-3">{t("En attente", "Waiting")}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-auto border-t border-line px-4 pb-5 pt-3">
        <p className="mb-2.5 flex items-center justify-center gap-1 text-[11px] text-ink-2">
          <IconShield size={12} className="text-brand" />
          {t("Votre téléphone revérifie la transaction", "Your phone re-checks the transaction")}
        </p>
        <span className="flex h-12 items-center justify-center rounded-full bg-brand text-[14px] font-semibold text-on-brand">{t("Approuver", "Approve")}</span>
      </div>
    </>
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
      <Heading
        eyebrow={t("Le problème", "The problem")}
        title={t("Aujourd'hui, la caisse n'a qu'une seule clé.", "Today, the fund has only one key.")}
        sub={t(
          "Les associations sénégalaises collectent des cotisations, souvent une fois par mois. Presque toujours, une seule personne les garde, et une dispute suffit à casser la confiance.",
          "Senegalese associations collect dues, often once a month. Almost always, one person keeps them, and one dispute is enough to break trust.",
        )}
      />
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <div className="rounded-[28px] bg-surface p-6 ring-1 ring-line sm:p-8">
          <Chip tone="neutral">{t("Aujourd'hui", "Today")}</Chip>
          <ul className="mt-5 flex flex-col gap-5">
            {rows.map(([label, today]) => (
              <li key={label}>
                <p className="text-[13px] font-semibold text-ink-3">{label}</p>
                <p className="mt-0.5 text-[16px] text-ink-2">{today}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[28px] bg-brand-soft p-6 sm:p-8">
          <Chip tone="brand" className="bg-brand text-on-brand">
            {t("Avec Koinon", "With Koinon")}
          </Chip>
          <ul className="mt-5 flex flex-col gap-5">
            {rows.map(([label, , koinon]) => (
              <li key={label}>
                <p className="text-[13px] font-semibold text-brand-ink/70">{label}</p>
                <p className="mt-0.5 text-[16px] font-semibold text-ink">{koinon}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- features */

function Features() {
  const t = useT();
  const items = [
    {
      icon: <IconUsers size={22} />,
      title: t("Deux signatures, toujours", "Two signatures, always"),
      body: t("Chaque dépense attend un deuxième responsable. Ce n'est pas un réglage : c'est le script Bitcoin du fonds.", "Every spend waits for a second officer. It is not a setting: it is the fund's Bitcoin script."),
    },
    {
      icon: <IconEye size={22} />,
      title: t("Chaque membre voit tout", "Every member sees everything"),
      body: t("Un lien en lecture seule, à poster dans le groupe WhatsApp : solde, cotisations et dépenses, en francs CFA.", "A read-only link to post in the WhatsApp group: balance, dues and spends, in CFA francs."),
    },
    {
      icon: <IconLifebuoy size={22} />,
      title: t("Une porte de secours à délai", "A time-locked emergency exit"),
      body: t("Si deux téléphones sont perdus, un responsable et l'assemblée récupèrent le fonds, après un délai que personne ne peut raccourcir.", "If two phones are lost, one officer and the assembly recover the fund, after a delay nobody can shorten."),
    },
  ];
  return (
    <Section className="pt-0 sm:pt-0">
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <article key={item.title} className="flex flex-col gap-4 rounded-[28px] bg-surface p-6 ring-1 ring-line sm:p-7">
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">{item.icon}</span>
            <h3 className="text-[20px] font-bold tracking-[-0.01em]">{item.title}</h3>
            <p className="text-[15px] leading-relaxed text-ink-2">{item.body}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- how it works */

function HowItWorks() {
  const t = useT();
  const steps = [
    {
      who: PEOPLE.O1,
      title: t("Le trésorier demande", "The treasurer asks"),
      body: t(
        "Il saisit le montant en francs CFA, le destinataire et le motif. Le taux est figé, et la demande part chiffrée aux deux autres responsables par Nostr.",
        "He enters the amount in CFA francs, the recipient and the purpose. The rate is locked, and the request goes encrypted to the two other officers over Nostr.",
      ),
    },
    {
      who: PEOPLE.O2,
      title: t("Une 2ᵉ responsable vérifie et signe", "A 2nd officer checks and signs"),
      body: t(
        "Son téléphone relit la transaction lui-même : bon destinataire, bon montant, frais sous le plafond. Si le serveur a changé un octet, il refuse de signer.",
        "Her phone re-reads the transaction itself: right recipient, right amount, fee under the cap. If the server changed one byte, it refuses to sign.",
      ),
    },
    {
      who: null,
      title: t("Tout le monde le voit", "Everyone sees it"),
      body: t(
        "Bitcoin accepte deux signatures et rien de moins. La dépense apparaît chez chaque membre, avec son motif.",
        "Bitcoin accepts two signatures and nothing less. The spend shows up for every member, with its purpose.",
      ),
    },
  ];
  return (
    <Section id="comment">
      <Heading eyebrow={t("Comment ça marche", "How it works")} title={t("Une dépense, trois étapes.", "One spend, three steps.")} />
      <ol className="mt-12 grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex flex-col gap-4 rounded-[28px] bg-card p-6 sm:p-7">
            <div className="flex items-center justify-between">
              <span className="tabular grid size-9 place-items-center rounded-full bg-surface text-[15px] font-bold">{index + 1}</span>
              {step.who ? <Avatar name={step.who.name} tone={step.who.tone} size={36} /> : <Avatar name="12" tone="good" size={36}><IconUsers size={17} /></Avatar>}
            </div>
            <h3 className="text-[20px] font-bold tracking-[-0.01em]">{step.title}</h3>
            <p className="text-[15px] leading-relaxed text-ink-2">{step.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ---------------------------------------------------------------- refusals */

function Refusals() {
  const t = useT();
  const attacks = [
    {
      title: t("Le trésorier dépense seul", "The treasurer spends alone"),
      code: "Signature must be zero for failed CHECK(MULTI)SIG",
      who: "Bitcoin Core",
      answer: t("Le nœud rejette la transaction. Notre serveur n'a rien décidé.", "The node rejects the transaction. Our server decided nothing."),
    },
    {
      title: t("Le serveur change le destinataire", "The server swaps the recipient"),
      code: "PSBT_MISMATCH",
      who: t("Téléphone de la secrétaire", "Secretary's phone"),
      answer: t("Son téléphone compare la transaction à la demande lue, et refuse de signer.", "Her phone compares the transaction with the request she read, and refuses to sign."),
    },
    {
      title: t("Récupération trop tôt", "Recovery too early"),
      code: "non-BIP68-final",
      who: "Bitcoin Core",
      answer: t("Le chemin de secours attend N blocs après chaque cotisation (10 en démo).", "The fallback path waits N blocks after each due (10 in the demo)."),
    },
    {
      title: t("Demande expirée", "Expired request"),
      code: "REQUEST_EXPIRED",
      who: t("Téléphone et serveur", "Phone and server"),
      answer: t("Après 24 heures, personne ne peut la signer ni l'envoyer.", "After 24 hours, nobody can sign or send it."),
    },
    {
      title: t("Quelqu'un modifie l'historique", "Someone edits the history"),
      code: "audit broken at seq 1",
      who: t("Vérification d'audit", "Audit check"),
      answer: t("Chaque ligne porte l'empreinte de la précédente. La chaîne casse, et le dit.", "Each row carries the hash of the previous one. The chain breaks, and says so."),
    },
  ];
  return (
    <section id="refus" className="scroll-mt-24 px-3 sm:px-5">
      <div className="mx-auto max-w-[1240px] rounded-[40px] bg-[#111113] px-5 py-20 text-white sm:px-10 sm:py-24">
        <div className="mx-auto max-w-[1080px]">
          <div className="flex max-w-[720px] flex-col gap-4">
            <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#a993ff]">{t("Essayez de tricher", "Try to cheat")}</span>
            <h2 className="text-[34px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[46px]">{t("Les règles ne vivent pas dans un bouton désactivé.", "The rules don't live in a disabled button.")}</h2>
            <p className="text-[17px] leading-relaxed text-white/65">
              {t(
                "Chaque refus ci-dessous est produit par la suite de tests sur GitHub Actions, contre un vrai nœud Bitcoin Core. Dans la démo, vous pouvez les provoquer vous-même.",
                "Each refusal below is produced by the test suite on GitHub Actions, against a real Bitcoin Core node. In the demo, you can trigger them yourself.",
              )}
            </p>
          </div>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {attacks.map((attack) => (
              <article key={attack.code} className="flex flex-col gap-3 rounded-[24px] bg-white/[0.06] p-5 ring-1 ring-white/10">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-[#ff5d5d]/15 px-2.5 text-[12px] font-semibold text-[#ff8a8a]">
                    <IconShield size={13} />
                    {t("Refusé", "Refused")}
                  </span>
                  <span className="truncate text-[12px] text-white/50">{attack.who}</span>
                </div>
                <h3 className="text-[17px] font-bold">{attack.title}</h3>
                <p className="text-[14px] leading-relaxed text-white/65">{attack.answer}</p>
                <p className="mt-auto break-words rounded-xl bg-black/40 px-3 py-2 font-mono text-[12px] leading-relaxed text-[#ff8a8a]">{attack.code}</p>
              </article>
            ))}
            <a href="/app" className="press group flex flex-col justify-between gap-6 rounded-[24px] bg-brand p-5 text-on-brand">
              <span className="text-[17px] font-bold">{t("Provoquez-les vous-même, dans la démo.", "Trigger them yourself, in the demo.")}</span>
              <span className="flex items-center gap-2 text-[14.5px] font-semibold">
                {t("Ouvrir l'app", "Open the app")}
                <IconArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
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
    [t("Clés chiffrées sur l'appareil, passkey ou code", "Keys encrypted on the device, passkey or code"), "live", "PBKDF2 310k + AES-256-GCM"],
    [t("Journal d'audit chaîné", "Hash-chained audit log"), "live", t("Vérifiable par tout membre", "Verifiable by any member")],
    [t("Prix BTC/EUR", "BTC/EUR price"), "sim", t("Valeur fixe de démo (60 000 €), affichée comme telle", "Fixed demo value (€60,000), labelled as such")],
    [
      t("Frais pour poser 5 000 F on-chain", "Fee to land 5,000 F on-chain"),
      "live",
      t("~100 F à 2 sat/vB, payés par le membre, pas prélevés sur la caisse", "~100 F at 2 sat/vB, paid by the member, not taken from the fund"),
    ],
    [t("Trois responsables dans un seul navigateur", "Three officers in one browser"), "sim", t("Pour la démo. Un vrai fonds : une clé par téléphone", "For the demo. A real fund: one key per phone")],
    [t("Rejoindre un fonds depuis un 2ᵉ téléphone", "Join a fund from a 2nd phone"), "next", t("Invitation par QR", "QR invitation")],
    [t("Cotiser par Wave ou Orange Money", "Pay dues with Wave or Orange Money"), "next", t("Via un pont Mobile Money", "Through a Mobile Money bridge")],
    [t("Lightning, wolof, réseau principal", "Lightning, Wolof, mainnet"), "next", t("Le réseau principal attend un audit", "Mainnet waits for an audit")],
  ];
  const mark: Record<Mark, { label: string; tone: "good" | "warn" | "neutral" }> = {
    live: { label: t("En ligne", "Live"), tone: "good" },
    sim: { label: t("Simulé", "Simulated"), tone: "warn" },
    next: { label: t("Prochain", "Next"), tone: "neutral" },
  };
  return (
    <Section id="statut">
      <Heading
        eyebrow={t("Où en est le projet", "Where it stands")}
        title={t("Honnête, ligne par ligne.", "Honest, line by line.")}
        sub={t("Ce qui tourne, ce qui est simulé pour la démo, et ce qui vient ensuite.", "What runs, what is simulated for the demo, and what comes next.")}
      />
      <div className="mt-12 overflow-hidden rounded-[28px] bg-surface ring-1 ring-line">
        {rows.map(([what, kind, note]) => (
          <div key={what} className="grid gap-2 border-t border-line px-5 py-4 first:border-t-0 sm:grid-cols-[minmax(0,1.3fr)_120px_minmax(0,1fr)] sm:items-center sm:gap-4 sm:px-7">
            <span className="text-[15.5px] font-semibold">{what}</span>
            <span>
              <Chip tone={mark[kind].tone} dot>
                {mark[kind].label}
              </Chip>
            </span>
            <span className="text-[14px] text-ink-2">{note}</span>
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
      t("5 000 F de cotisation, ce n'est pas trop petit pour Bitcoin ?", "Isn't a 5,000 F due too small for Bitcoin?"),
      t(
        "À 60 000 €/BTC, 5 000 F font 12 705 sats. Les poser sur l'adresse 2-sur-3 (~122 vbytes) coûte 244 sats à 2 sat/vB, soit 96 F — payés par le portefeuille du membre, pas retirés de la caisse. À 5 sat/vB, 240 F. C'est pourquoi Koinon est une caisse d'association (mensuelle, plutôt 10–50 000 F), pas une tontine hebdomadaire de 500 F. Lightning servirait ces petites parts ; on ne l'a pas ajouté, parce qu'un nœud qui reçoit Lightning tient les fonds.",
        "At €60,000/BTC, 5,000 F is 12,705 sats. Landing it on the 2-of-3 address (~122 vbytes) costs 244 sats at 2 sat/vB, which is 96 F — paid by the member's wallet, not taken from the fund. At 5 sat/vB, 240 F. That is why Koinon is an association treasury (monthly, more like 10–50,000 F), not a 500 F weekly tontine. Lightning would serve those small shares; we did not add it, because a Lightning receiving node holds the coins.",
      ),
    ],
    [
      t("Les sats de la démo ont-ils une valeur ?", "Do the demo sats have value?"),
      t("Non. La démo tourne sur regtest, un réseau Bitcoin privé de test. L'app le rappelle partout.", "No. The demo runs on regtest, a private Bitcoin test network. The app says so everywhere."),
    ],
  ];
  return (
    <Section id="faq">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Heading eyebrow="FAQ" title={t("Ce qu'un trésorier demande en premier.", "What a treasurer asks first.")} />
        <div className="flex flex-col gap-2.5">
          {items.map(([question, answer]) => (
            <details key={question} className="group rounded-[22px] bg-surface px-5 ring-1 ring-line open:pb-5">
              <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-4 text-[16.5px] font-semibold [&::-webkit-details-marker]:hidden">
                {question}
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-card text-ink-2 transition-transform duration-300 group-open:rotate-180">
                  <IconChevronDown size={17} />
                </span>
              </summary>
              <p className="max-w-[640px] text-[15px] leading-relaxed text-ink-2">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Closing() {
  const t = useT();
  return (
    <section className="px-3 pb-16 sm:px-5">
      <div className="relative mx-auto flex max-w-[1240px] flex-col items-center overflow-hidden rounded-[40px] bg-brand px-6 py-20 text-center text-on-brand sm:py-24">
        <div aria-hidden className="absolute -bottom-24 -right-16 opacity-25">
          <Logo size={280} withName={false} />
        </div>
        <span className="relative inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold">
          <IconClock size={14} />
          {t("Deux minutes, dans le navigateur", "Two minutes, in the browser")}
        </span>
        <h2 className="relative mt-5 max-w-[720px] text-[36px] font-bold leading-[1.06] tracking-[-0.03em] sm:text-[52px]">
          {t("Jouez les deux responsables. Essayez de tricher.", "Play both officers. Try to cheat.")}
        </h2>
        <p className="relative mt-4 max-w-[560px] text-[17px] leading-relaxed text-white/80">
          {t(
            "La démo crée un dahira de 12 membres, avec de vraies clés et de vraies transactions regtest. Deux téléphones côte à côte.",
            "The demo creates a 12-member dahira, with real keys and real regtest transactions. Two phones side by side.",
          )}
        </p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <a href="/app" className="press inline-flex h-14 items-center gap-2 rounded-full bg-white px-7 text-[16px] font-semibold text-[#111113] hover:bg-white/90">
            {t("Ouvrir l'app", "Open the app")}
            <IconArrowRight size={18} />
          </a>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="press inline-flex h-14 items-center rounded-full bg-white/15 px-7 text-[16px] font-semibold hover:bg-white/20">
            {t("Lire le code", "Read the code")}
          </a>
        </div>
      </div>
    </section>
  );
}
