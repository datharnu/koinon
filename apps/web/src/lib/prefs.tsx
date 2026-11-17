import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "fr" | "en";
export type Theme = "dark" | "light";

interface Prefs {
  lang: Lang;
  setLang: (lang: Lang) => void;
  theme: Theme;
  toggleTheme: () => void;
  /** French first, English second, side by side so copy never drifts. */
  t: (fr: string, en: string) => string;
}

const PrefsContext = createContext<Prefs | null>(null);

function initialLang(): Lang {
  const saved = localStorage.getItem("koinon.lang");
  return saved === "en" ? "en" : "fr";
}

function initialTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem("koinon.lang", next);
    setLangState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const apply = () => {
      document.documentElement.dataset.theme = next;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#09090a" : "#f1f1ee");
      localStorage.setItem("koinon.theme", next);
      setTheme(next);
    };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (!reduce && typeof doc.startViewTransition === "function") doc.startViewTransition(apply);
    else apply();
  }, [theme]);

  const value = useMemo<Prefs>(
    () => ({ lang, setLang, theme, toggleTheme, t: (fr, en) => (lang === "fr" ? fr : en) }),
    [lang, setLang, theme, toggleTheme],
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const value = useContext(PrefsContext);
  if (!value) throw new Error("PrefsProvider missing");
  return value;
}

export function useT() {
  return usePrefs().t;
}
