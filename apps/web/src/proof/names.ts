import type { ProofRole } from "@koinon/core/proof";
import type { FundView } from "../lib/http";
import { PEOPLE } from "../lib/people";
import type { Lang } from "../lib/prefs";
import { labelFor } from "./load";

const DEMO_LABELS: Record<ProofRole, string[]> = {
  O1: ["Trésorier", "Treasurer"],
  O2: ["Secrétaire", "Secretary"],
  O3: ["Président", "President"],
  K: ["Assemblée", "Assembly"],
};

/** The chain proves the role. The demo's first names are used only for the default labels. */
export function signerName(fund: FundView, role: ProofRole, lang: Lang): string {
  const label = labelFor(fund, role);
  if (DEMO_LABELS[role].includes(label)) {
    if (role === "K") return lang === "fr" ? "Assemblée" : "Assembly";
    return PEOPLE[role].first;
  }
  return label;
}

export function whoSigned(fund: FundView, roles: ProofRole[], lang: Lang): string {
  return roles.map((role) => signerName(fund, role, lang)).join(" + ");
}
