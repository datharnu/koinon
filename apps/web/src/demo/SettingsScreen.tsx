import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { endpoints } from "../lib/api";
import { errorCode, type OfficerRole } from "../lib/flows";
import { middle, sats } from "../lib/format";
import { readUnlock } from "../lib/passkey";
import { memberTone, PEOPLE, roleTitle } from "../lib/people";
import { usePrefs } from "../lib/prefs";
import { forgetFund } from "../lib/vault";
import { Avatar, Chip } from "../ui/avatar";
import { Button, Spinner } from "../ui/button";
import { IconChain, IconGlobe, IconLifebuoy, IconLink, IconPalette, IconPasskey, IconUsers } from "../ui/icons";
import { Sheet } from "../ui/sheet";
import { EmptyState, ErrorState, Skeleton } from "../ui/states";
import { useToast } from "../ui/toast";
import { LangToggle, Segmented } from "../ui/toggles";
import { ActivityList } from "./Activity";
import { useDemo } from "./context";
import { useFund, useMembers } from "./hooks";
import { InviteSheet } from "./HomeScreen";
import { Group, IconBubble, LargeTitle, Row, ScreenHeader, SectionTitle, useNav } from "./ui";

export function SettingsScreen({ role }: { role: OfficerRole }) {
  const { t, lang, theme, toggleTheme } = usePrefs();
  const demo = useDemo();
  const nav = useNav();
  const toast = useToast();
  const fund = useFund(demo.config.fundId);
  const members = useMembers(demo.config.fundId);
  const audit = useQuery({ queryKey: ["audit", demo.config.fundId], queryFn: () => endpoints.auditVerify(demo.config.fundId), enabled: false });
  const [forgetting, setForgetting] = useState(false);
  const me = PEOPLE[role];
  const unlock = readUnlock();

  const copy = (label: string, value: string) => {
    void navigator.clipboard?.writeText(value).then(() => toast({ tone: "info", title: t(`${label} copié`, `${label} copied`) }));
  };

  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-6">
      <LargeTitle>{t("Réglages", "Settings")}</LargeTitle>
      <div className="flex flex-col gap-5 px-4">
        <div className="flex items-center gap-3.5 rounded-[22px] bg-card p-4">
          <Avatar name={me.name} tone={me.tone} size={52} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-bold">{me.name}</p>
            <p className="truncate text-[13px] text-ink-2">{roleTitle(role, t)}</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-3">
              <IconPasskey size={14} />
              {unlock?.method === "passkey" ? t("Clé protégée par passkey", "Key protected by passkey") : t("Clé protégée par code", "Key protected by code")}
            </p>
          </div>
        </div>

        <section>
          <SectionTitle>{t("Caisse", "Fund")}</SectionTitle>
          <Group>
            <Row
              icon={<IconBubble><IconUsers size={18} /></IconBubble>}
              title={t("Membres", "Members")}
              right={<span className="tabular text-[14px] text-ink-2">{members.data?.members.length ?? "…"}</span>}
              onClick={() => nav.push({ name: "members" })}
              chevron
            />
            <Row
              icon={<IconBubble><IconLink size={18} /></IconBubble>}
              title={t("Lien membres", "Member link")}
              subtitle={t("Lecture seule, à partager", "Read only, to share")}
              onClick={() => nav.sheet(<InviteSheet onClose={() => nav.sheet(null)} />)}
              chevron
            />
            <Row
              icon={<IconBubble tone="warn"><IconLifebuoy size={18} /></IconBubble>}
              title={t("Récupération", "Recovery")}
              subtitle={t("Si deux clés sont perdues", "If two keys are lost")}
              onClick={() => nav.push({ name: "recovery" })}
              chevron
            />
            <Row
              icon={<IconBubble><IconChain size={18} /></IconBubble>}
              title={t("Journal d'audit", "Audit log")}
              subtitle={t("Chaque action chaînée par hachage", "Every action hash-chained")}
              onClick={() => void audit.refetch()}
              right={
                audit.isFetching ? (
                  <Spinner size={16} className="text-ink-3" />
                ) : audit.isError ? (
                  <Chip tone="bad">{errorCode(audit.error)}</Chip>
                ) : audit.data ? (
                  audit.data.ok ? (
                    <Chip tone="good" dot>{t("Intacte", "Intact")}</Chip>
                  ) : (
                    <Chip tone="bad" dot>{t(`Cassée #${audit.data.seq ?? "?"}`, `Broken #${audit.data.seq ?? "?"}`)}</Chip>
                  )
                ) : (
                  <span className="text-[13px] font-semibold text-brand">{t("Vérifier", "Verify")}</span>
                )
              }
            />
          </Group>
        </section>

        <section>
          <SectionTitle>{t("Général", "General")}</SectionTitle>
          <Group>
            <Row
              icon={<IconBubble><IconPalette size={18} /></IconBubble>}
              title={t("Apparence", "Appearance")}
              right={
                <Segmented
                  label={t("Apparence", "Appearance")}
                  value={theme}
                  options={[
                    { id: "light", label: t("Clair", "Light") },
                    { id: "dark", label: t("Sombre", "Dark") },
                  ]}
                  onChange={(next) => {
                    if (next !== theme) toggleTheme();
                  }}
                />
              }
            />
            <Row icon={<IconBubble><IconGlobe size={18} /></IconBubble>} title={t("Langue", "Language")} right={<LangToggle />} />
          </Group>
        </section>

        <section>
          <SectionTitle>{t("Infos techniques", "Technical info")}</SectionTitle>
          <Group>
            <Row title={t("Réseau", "Network")} right={<Chip tone="warn">regtest</Chip>} />
            <Row title={t("Bloc actuel", "Current block")} right={<span className="tabular text-[14px] text-ink-2">{fund.data?.chain_tip ?? "…"}</span>} />
            <Row title={t("Délai de récupération", "Recovery delay")} right={<span className="text-[14px] text-ink-2">{t(`${demo.config.csvBlocks} blocs`, `${demo.config.csvBlocks} blocks`)}</span>} />
            <Row title={t("Plafond de frais", "Fee cap")} right={<span className="tabular text-[14px] text-ink-2">{sats(demo.config.feeCapSats, lang)} sats</span>} />
            <Row title={t("Identifiant", "Fund id")} subtitle={<span className="font-mono">{middle(demo.config.fundId, 8)}</span>} onClick={() => copy(t("Identifiant", "Fund id"), demo.config.fundId)} />
            <Row title="xpub" subtitle={<span className="font-mono">{middle(demo.config.officers[role].xpub, 10)}</span>} onClick={() => copy("xpub", demo.config.officers[role].xpub)} />
          </Group>
        </section>

        <Group>
          <Row title={t("Oublier ce téléphone", "Forget this phone")} danger onClick={() => setForgetting(true)} />
        </Group>
        <p className="px-2 text-center text-[12px] leading-snug text-ink-3">
          {t("Koinon · démo regtest. Les sats de test n'ont aucune valeur.", "Koinon · regtest demo. Test sats have no value.")}
        </p>
      </div>

      <Sheet
        open={forgetting}
        contained
        onClose={() => setForgetting(false)}
        title={t("Oublier ce téléphone ?", "Forget this phone?")}
        footer={
          <div className="flex flex-col gap-1">
            <Button
              variant="danger"
              size="lg"
              block
              onClick={() => {
                forgetFund();
                window.location.assign("/app");
              }}
            >
              {t("Effacer les clés de démo", "Erase the demo keys")}
            </Button>
            <Button variant="ghost" block onClick={() => setForgetting(false)}>
              {t("Annuler", "Cancel")}
            </Button>
          </div>
        }
      >
        <p className="pb-1 text-[14px] leading-snug text-ink-2">
          {t(
            "Les quatre clés de démo quittent ce navigateur. La caisse regtest reste sur le serveur, mais plus personne ici ne pourra signer.",
            "The four demo keys leave this browser. The regtest fund stays on the server, but nobody here can sign any more.",
          )}
        </p>
      </Sheet>
    </div>
  );
}

export function MembersScreen() {
  const { t } = usePrefs();
  const demo = useDemo();
  const nav = useNav();
  const toast = useToast();
  const members = useMembers(demo.config.fundId);
  return (
    <>
      <ScreenHeader title={t("Membres", "Members")} onBack={nav.back} />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <p className="px-1 pb-3 text-[13px] leading-snug text-ink-2">
          {t(
            "Chaque membre a sa propre adresse de cotisation. Touchez pour la copier. Poser 5 000 F sur cette adresse coûte ~100 F de frais réseau à 2 sat/vB, payés par le membre, pas par la caisse.",
            "Each member has their own dues address. Tap to copy it. Landing 5,000 F on this address costs ~100 F in network fees at 2 sat/vB, paid by the member, not by the fund.",
          )}
        </p>
        {members.isPending ? (
          <Skeleton className="h-64 rounded-[22px]" />
        ) : members.isError && !members.data ? (
          <ErrorState error={members.error} onRetry={() => void members.refetch()} />
        ) : members.data.members.length === 0 ? (
          <EmptyState icon={<IconUsers size={24} />} title={t("Aucun membre", "No members")} />
        ) : (
          <Group>
            {members.data.members.map((member) => (
              <Row
                key={member.index}
                icon={<Avatar name={member.pseudonym} tone={memberTone(member.index)} size={36} />}
                title={member.pseudonym}
                subtitle={<span className="font-mono">{middle(member.address, 9)}</span>}
                right={<span className="tabular text-[12px] text-ink-3">#{member.index}</span>}
                onClick={() => void navigator.clipboard?.writeText(member.address).then(() => toast({ tone: "info", title: t("Adresse copiée", "Address copied"), body: member.pseudonym }))}
              />
            ))}
          </Group>
        )}
      </div>
    </>
  );
}

export function ActivityScreen() {
  const { t } = usePrefs();
  const demo = useDemo();
  const nav = useNav();
  return (
    <>
      <ScreenHeader title={t("Activité", "Activity")} onBack={nav.back} />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <ActivityList fundId={demo.config.fundId} />
      </div>
    </>
  );
}
