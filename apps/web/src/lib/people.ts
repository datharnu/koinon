import type { Role } from "@koinon/core";

export type Tone = "amber" | "sky" | "rose" | "stone" | "brand" | "good";

/** Demo people. A real fund uses the names the officers type in; the server only knows the role labels. */
export const PEOPLE: Record<Role, { name: string; first: string; tone: Tone }> = {
  O1: { name: "Ibou Sarr", first: "Ibou", tone: "amber" },
  O2: { name: "Coumba Diallo", first: "Coumba", tone: "sky" },
  O3: { name: "Malick Faye", first: "Malick", tone: "rose" },
  K: { name: "Assemblée", first: "Assemblée", tone: "stone" },
};

export function roleTitle(role: Role, t: (fr: string, en: string) => string): string {
  switch (role) {
    case "O1":
      return t("Trésorier", "Treasurer");
    case "O2":
      return t("Secrétaire", "Secretary");
    case "O3":
      return t("Président", "President");
    default:
      return t("Clé de l'assemblée", "Assembly key");
  }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}

const MEMBER_TONES: Tone[] = ["amber", "sky", "rose", "good", "brand", "stone"];

export function memberTone(index: number): Tone {
  return MEMBER_TONES[index % MEMBER_TONES.length] ?? "stone";
}
