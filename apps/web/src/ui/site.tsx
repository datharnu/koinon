import { Link } from "wouter";
import { useT } from "../lib/prefs";
import { ButtonLink } from "./button";
import { IconArrowRight, IconGithub, Logo } from "./icons";
import { LangToggle, ThemeToggle } from "./toggles";

export const REPO_URL = "https://github.com/datharnu/koinon";

export function SiteNav({ links = true }: { links?: boolean }) {
  const t = useT();
  const items = [
    { href: "/#comment", label: t("Comment ça marche", "How it works") },
    { href: "/#refus", label: t("Sécurité", "Security") },
    { href: "/#statut", label: t("Statut", "Status") },
    { href: "/#faq", label: "FAQ" },
  ];
  return (
    <header className="fixed inset-x-0 top-3 z-40 flex justify-center px-3">
      <nav className="flex h-14 w-full max-w-[1040px] items-center gap-2 rounded-full bg-surface/85 pl-4 pr-2 shadow-[0_10px_40px_-20px_rgb(20_14_60/0.35)] ring-1 ring-line backdrop-blur-xl">
        <Link href="/" aria-label={t("Accueil Koinon", "Koinon home")} className="shrink-0">
          <Logo withName />
        </Link>
        {links ? (
          <div className="mx-auto hidden items-center gap-1 md:flex">
            {items.map((item) => (
              <a key={item.href} href={item.href} className="rounded-full px-3.5 py-2 text-[14px] font-medium text-ink-2 transition-colors hover:bg-card hover:text-ink">
                {item.label}
              </a>
            ))}
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <span className="max-sm:hidden">
            <LangToggle />
          </span>
          <ThemeToggle />
          <ButtonLink href="/app" size="sm" className="ml-1">
            {t("Ouvrir l'app", "Open the app")}
          </ButtonLink>
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-5 pb-10 pt-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2">
        <Logo withName />
        <p className="max-w-[420px] text-[13px] leading-snug text-ink-3">
          {t("Démo sur regtest : les sats n'ont aucune valeur. Le code est public sur GitHub.", "Demo on regtest: sats have no value. The code is public on GitHub.")}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink href={REPO_URL} external variant="secondary" size="sm" icon={<IconGithub size={16} />}>
          GitHub
        </ButtonLink>
        <ButtonLink href="/app" variant="ghost" size="sm">
          {t("Démo", "Demo")}
          <IconArrowRight size={15} />
        </ButtonLink>
      </div>
    </footer>
  );
}
