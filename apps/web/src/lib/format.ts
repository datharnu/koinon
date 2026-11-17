import type { Lang } from "./prefs";

/** XOF are integers; group with a narrow no-break space the way Dakar prints prices. */
export function xof(value: string | number | bigint | null | undefined, lang: Lang): string {
  if (value === null || value === undefined || value === "") return "—";
  const text = BigInt(value).toString();
  const grouped = text.replace(/\B(?=(\d{3})+(?!\d))/g, lang === "fr" ? "\u202f" : ",");
  return `${grouped} F`;
}

/** Sats arrive as decimal strings. Never parse them into a float. */
export function sats(value: string | bigint | null | undefined, lang: Lang): string {
  if (value === null || value === undefined || value === "") return "—";
  const text = BigInt(value).toString();
  return text.replace(/\B(?=(\d{3})+(?!\d))/g, lang === "fr" ? "\u202f" : ",");
}

/** Middle cut for rows. Full value stays in the title and on detail views. */
export function middle(value: string, keep = 8): string {
  if (value.length <= keep * 2 + 1) return value;
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}

export function clock(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleTimeString(lang === "fr" ? "fr-SN" : "en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function relative(iso: string, lang: Lang, now = Date.now()): string {
  const diff = Math.round((new Date(iso).getTime() - now) / 60_000);
  const format = new Intl.RelativeTimeFormat(lang === "fr" ? "fr" : "en", { numeric: "auto" });
  if (Math.abs(diff) < 60) return format.format(diff, "minute");
  return format.format(Math.round(diff / 60), "hour");
}
