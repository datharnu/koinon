/** The one expense the walkthrough carries from Ibou's first tap to the member's receipt. */
export const HALL_XOF = 15_000;

export function hallPurpose(t: (fr: string, en: string) => string): string {
  return t("Location de la salle pour l'assemblée générale", "Hall rental for the general assembly");
}
