import { useT } from "../lib/prefs";
import { ButtonLink } from "../ui/button";
import { TopBar } from "../ui/chrome";

export function NotFound() {
  const t = useT();
  return (
    <>
      <TopBar />
      <main className="mx-auto flex max-w-[640px] flex-col items-start gap-4 px-4 py-24">
        <span className="font-mono text-[12px] text-text-3">404</span>
        <h1 className="text-[34px]">{t("Cette page n'existe pas.", "This page does not exist.")}</h1>
        <ButtonLink href="/" variant="secondary">
          {t("Retour à l'accueil", "Back home")}
        </ButtonLink>
      </main>
    </>
  );
}
