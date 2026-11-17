import { useT } from "../lib/prefs";
import { ButtonLink } from "../ui/button";
import { SiteNav } from "../ui/site";

export function NotFound() {
  const t = useT();
  return (
    <>
      <SiteNav links={false} />
      <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-center justify-center gap-4 px-5 text-center">
        <span className="tabular text-[88px] font-bold leading-none tracking-[-0.05em] text-brand">404</span>
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">{t("Cette page n'existe pas.", "This page does not exist.")}</h1>
        <p className="text-[16px] text-ink-2">{t("Le lien est peut-être incomplet.", "The link may be incomplete.")}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <ButtonLink href="/">{t("Retour à l'accueil", "Back home")}</ButtonLink>
          <ButtonLink href="/app" variant="secondary">
            {t("Ouvrir l'app", "Open the app")}
          </ButtonLink>
        </div>
      </main>
    </>
  );
}
