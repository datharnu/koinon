import { usePrefs } from "../lib/prefs";

export function ThemeToggle() {
  const { theme, toggleTheme, t } = usePrefs();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? t("Passer au thème clair", "Switch to light theme") : t("Passer au thème sombre", "Switch to dark theme")}
      className="relative grid size-9 place-items-center overflow-hidden rounded-[var(--radius-ctl)] text-text-2 transition-colors hover:bg-raise hover:text-text"
    >
      <svg aria-hidden viewBox="0 0 20 20" className={`absolute size-[18px] transition-transform duration-500 ease-[var(--ease-out)] ${dark ? "translate-y-0" : "-translate-y-8"}`}>
        <path d="M15.5 12.3A6.5 6.5 0 0 1 7.7 4.5a6.5 6.5 0 1 0 7.8 7.8Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      <svg aria-hidden viewBox="0 0 20 20" className={`absolute size-[18px] transition-transform duration-500 ease-[var(--ease-out)] ${dark ? "translate-y-8" : "translate-y-0"}`}>
        <circle cx="10" cy="10" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3 6 14M14 6l1.3-1.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function LangToggle() {
  const { lang, setLang } = usePrefs();
  return (
    <div role="group" aria-label="Langue / Language" className="flex h-9 items-center rounded-[var(--radius-ctl)] bg-raise p-0.5 hairline">
      {(["fr", "en"] as const).map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={lang === item}
          onClick={() => setLang(item)}
          className={`h-8 rounded-[8px] px-2.5 font-mono text-[12px] uppercase transition-colors ${lang === item ? "bg-panel text-text hairline" : "text-text-3 hover:text-text"}`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
