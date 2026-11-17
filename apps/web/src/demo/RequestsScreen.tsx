import { xof } from "../lib/format";
import type { OfficerRole } from "../lib/flows";
import { PEOPLE } from "../lib/people";
import { usePrefs } from "../lib/prefs";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { IconInbox, IconSend } from "../ui/icons";
import { EmptyState, ErrorState, Skeleton } from "../ui/states";
import { useOfficerRequests, type RequestEntry } from "./hooks";
import { StatusChip } from "./RequestStatus";
import { Group, LargeTitle, Row, SectionTitle, useNav } from "./ui";

export function RequestsScreen({ role }: { role: OfficerRole }) {
  const { t } = usePrefs();
  const nav = useNav();
  const { inbox, entries } = useOfficerRequests(role);

  const compose = (
    <Button size="sm" variant="soft" icon={<IconSend size={16} />} onClick={() => nav.push({ name: "spend" })}>
      {t("Nouvelle", "New")}
    </Button>
  );

  const sections: { id: RequestEntry["bucket"]; title: string }[] = [
    { id: "sign", title: t("À signer", "To sign") },
    { id: "open", title: t("En cours", "In progress") },
    { id: "done", title: t("Terminées", "Done") },
  ];

  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-4">
      <LargeTitle right={compose}>{t("Demandes", "Requests")}</LargeTitle>
      <div className="flex flex-col gap-5 px-4">
        {inbox.isPending ? (
          <Group className="flex flex-col gap-4 p-4">
            {[0, 1, 2].map((key) => (
              <div key={key} className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-1/2 rounded-md" />
                  <Skeleton className="h-3 w-3/4 rounded-md" />
                </div>
              </div>
            ))}
          </Group>
        ) : inbox.isError && !inbox.data ? (
          <ErrorState error={inbox.error} onRetry={() => void inbox.refetch()} title={t("Relais injoignable", "Relay unreachable")} />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<IconInbox size={24} />}
            title={t("Aucune demande", "No requests")}
            body={t(
              "Quand un membre du bureau veut dépenser, sa demande arrive ici, chiffrée de bout en bout.",
              "When an officer wants to spend, their request lands here, end-to-end encrypted.",
            )}
            action={
              <Button block onClick={() => nav.push({ name: "spend" })}>
                {t("Nouvelle dépense", "New spend")}
              </Button>
            }
          />
        ) : (
          sections.map((section) => {
            const items = entries.filter((entry) => entry.bucket === section.id);
            if (items.length === 0) return null;
            return (
              <section key={section.id}>
                <SectionTitle>
                  {section.title} <span className="text-ink-3">· {items.length}</span>
                </SectionTitle>
                <Group>
                  {items.map((entry) => (
                    <RequestRow key={entry.item.requestId} entry={entry} role={role} />
                  ))}
                </Group>
              </section>
            );
          })
        )}
        <p className="px-2 text-center text-[12px] text-ink-3">{t("Reçues par le relais Nostr, chiffrées pour ce téléphone.", "Received through the Nostr relay, encrypted for this phone.")}</p>
      </div>
    </div>
  );
}

function RequestRow({ entry, role }: { entry: RequestEntry; role: OfficerRole }) {
  const { t, lang } = usePrefs();
  const nav = useNav();
  const request = entry.request;
  if (!request) {
    return (
      <div className="flex min-h-[64px] items-center gap-3 px-4">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-3.5 w-1/2 rounded-md" />
      </div>
    );
  }
  const person = PEOPLE[request.requester];
  return (
    <Row
      onClick={() => nav.push({ name: "request", id: request.id })}
      icon={<Avatar name={person.name} tone={person.tone} />}
      title={<span className="tabular">{xof(request.amount_xof, lang)}</span>}
      subtitle={`${entry.item.mine ? t("Vous", "You") : person.first} · ${entry.item.message?.purpose ?? request.purpose}`}
      right={<StatusChip request={request} role={role} />}
      chevron
    />
  );
}
