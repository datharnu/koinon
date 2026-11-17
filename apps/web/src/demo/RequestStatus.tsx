import type { Role } from "@koinon/core";
import type { RequestView } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import { Chip, type ChipTone } from "../ui/avatar";

export function statusLabel(request: RequestView, role: Role, t: (fr: string, en: string) => string): { tone: ChipTone; text: string } {
  const signed = request.approvals.some((approval) => approval.officer === role);
  switch (request.status) {
    case "draft":
    case "pending":
      return signed ? { tone: "warn", text: t("1 sur 2", "1 of 2") } : { tone: "brand", text: t("À signer", "To sign") };
    case "approved":
      return { tone: "good", text: t("Prête à envoyer", "Ready to send") };
    case "broadcast":
      return { tone: "warn", text: t("Sur le réseau", "On the network") };
    case "confirmed":
      return { tone: "good", text: t("Payée", "Paid") };
    case "rejected":
      return { tone: "bad", text: t("Refusée", "Rejected") };
    case "expired":
      return { tone: "neutral", text: t("Expirée", "Expired") };
    default:
      return { tone: "bad", text: t("Échec", "Failed") };
  }
}

export function StatusChip({ request, role }: { request: RequestView; role: Role }) {
  const { t } = usePrefs();
  const label = statusLabel(request, role, t);
  return (
    <Chip tone={label.tone} dot>
      {label.text}
    </Chip>
  );
}
