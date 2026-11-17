import { usePrefs } from "../lib/prefs";
import { IconMoon, IconSun } from "./icons";

export function ThemeToggle() {
  const { theme, toggleTheme, t } = usePrefs();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? t("Passer en clair", "Switch to light") : t("Passer en sombre", "Switch to dark")}
      className="press grid size-10 place-items-center rounded-full text-ink-2 hover:bg-card hover:text-ink"
    >
      {dark ? <IconSun size={19} /> : <IconMoon size={19} />}
    </button>
  );
}

export function LangToggle() {
  const { lang, setLang } = usePrefs();
  return (
    <div role="group" aria-label="Langue / Language" className="flex h-9 items-center rounded-full bg-card-2 p-1">
      {(["fr", "en"] as const).map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={lang === item}
          onClick={() => setLang(item)}
          className={`h-7 rounded-full px-3 text-[13px] font-semibold uppercase transition-colors ${lang === item ? "bg-surface text-ink shadow-[0_1px_4px_-1px_rgb(0_0_0/0.15)]" : "text-ink-3 hover:text-ink"}`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

/** Two-option segmented control used inside the app (theme, language). */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (value: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex h-9 items-center rounded-full bg-card-2 p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={`h-7 rounded-full px-3 text-[13px] font-semibold transition-colors ${value === option.id ? "bg-surface text-ink shadow-[0_1px_4px_-1px_rgb(0_0_0/0.15)]" : "text-ink-3"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
