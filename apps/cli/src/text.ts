export type Lang = "fr" | "en";

export function line(lang: Lang, fr: string, en: string): string {
  return lang === "en" ? en : fr;
}
