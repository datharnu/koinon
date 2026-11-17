import type { ReactNode } from "react";
import { Link } from "wouter";
import { useT } from "../lib/prefs";
import { ButtonLink } from "./button";
import { Logo } from "./motif";
import { LangToggle, ThemeToggle } from "./toggles";

export const REPO_URL = "https://github.com/datharnu/koinon";

export function TopBar({ cta = true, children }: { cta?: boolean; children?: ReactNode }) {
  const t = useT();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--color-ink)_82%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-3 px-4 sm:px-6">
        <Link href="/" aria-label={t("Accueil Koinon", "Koinon home")} className="rounded-md">
          <Logo />
        </Link>
        {children}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="hidden h-9 items-center rounded-[var(--radius-ctl)] px-3 text-sm text-text-2 hover:bg-raise hover:text-text sm:inline-flex">
            GitHub
          </a>
          <LangToggle />
          <ThemeToggle />
          {cta ? (
            <ButtonLink href="/app" size="sm" arrow className="max-sm:hidden">
              {t("Ouvrir l'app", "Open the app")}
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const t = useT();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex max-w-md flex-col gap-3">
          <Logo />
          <p className="text-[14px] leading-relaxed text-text-3">
            {t(
              "Réseau regtest : les sats n'ont pas de valeur. Pas encore audité, pas sur le réseau principal. Le multisig et la récupération à délai existent déjà dans Liana, Nunchuk et Sparrow ; Koinon y ajoute le travail d'une association.",
              "Regtest network: the sats have no value. Not audited, not on mainnet. Multisig and timelocked recovery already exist in Liana, Nunchuk and Sparrow; Koinon adds the workflow of an association.",
            )}
          </p>
        </div>
        <div className="flex flex-col gap-2 text-[14px]">
          <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-text-3">Dakar Bitcoin Hack 2026</span>
          <a className="text-text-2 hover:text-text" href={REPO_URL} target="_blank" rel="noreferrer">
            {t("Code source (MIT)", "Source code (MIT)")}
          </a>
          <Link className="text-text-2 hover:text-text" href="/app">
            {t("Essayer la démo", "Try the demo")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
