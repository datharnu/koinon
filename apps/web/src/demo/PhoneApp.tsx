import type { Role } from "@koinon/core";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { endpoints } from "../lib/api";
import { useState, type ReactNode } from "react";
import { usePrefs } from "../lib/prefs";
import type { OfficerRole } from "../lib/flows";
import { RegtestBadge, RoleChip } from "../ui/status";
import { StatusBar } from "../ui/phone";
import { useDemo } from "./context";
import { FundTab } from "./FundTab";
import { MoreTab } from "./MoreTab";
import { RequestsTab } from "./RequestsTab";
import { SpendTab } from "./SpendTab";
import { useInbox } from "./hooks";

export type Tab = "fund" | "requests" | "spend" | "more";

export function roleLabel(role: Role, t: (fr: string, en: string) => string): string {
  switch (role) {
    case "O1":
      return t("Trésorier", "Treasurer");
    case "O2":
      return t("Secrétaire", "Secretary");
    case "O3":
      return t("Président", "President");
    default:
      return t("Assemblée", "Assembly");
  }
}

export function PhoneApp({ role, framed, initialTab = "fund" }: { role: OfficerRole; framed: boolean; initialTab?: Tab }) {
  const { t } = usePrefs();
  const demo = useDemo();
  const [tab, setTab] = useState<Tab>(initialTab);
  const secret = demo.secrets[role];
  const inbox = useInbox(demo.config, role, secret, demo.pulse);
  const client = useQueryClient();
  const received = (inbox.data?.items ?? []).filter((item) => !item.mine);
  const statuses = useQueries({
    queries: received.map((item) => ({ queryKey: ["request", item.requestId], queryFn: () => endpoints.request(item.requestId), staleTime: 2_000 })),
  });
  const waiting = statuses.filter(({ data }) => data && (data.status === "pending" || data.status === "draft") && !data.approvals.some((approval) => approval.officer === role)).length;

  const go = (next: Tab) => {
    setTab(next);
    if (next === "requests") void client.invalidateQueries({ queryKey: ["inbox", demo.config.fundId, role] });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {framed ? <StatusBar right={<RegtestBadge label="regtest" />} /> : null}
      <header className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-2">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold" title={demo.config.name}>
            {demo.config.name}
          </p>
          {!framed ? <RegtestBadge label={t("regtest · sats sans valeur", "regtest · sats have no value")} /> : null}
        </div>
        {framed ? (
          <span className="shrink-0">
            <RoleChip role={role} label={roleLabel(role, t)} />
          </span>
        ) : null}
      </header>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
        {tab === "fund" ? <FundTab /> : null}
        {tab === "requests" ? <RequestsTab role={role} inbox={inbox} onCompose={() => go("spend")} /> : null}
        {tab === "spend" ? <SpendTab role={role} onDone={() => go("requests")} /> : null}
        {tab === "more" ? <MoreTab role={role} /> : null}
      </div>
      <nav aria-label={t("Navigation", "Navigation")} className="grid shrink-0 grid-cols-4 border-t border-line bg-panel px-2 pb-[max(env(safe-area-inset-bottom),10px)] pt-1.5">
        <TabButton active={tab === "fund"} onClick={() => go("fund")} label={t("Fonds", "Fund")} icon={<IconFund />} />
        <TabButton active={tab === "requests"} onClick={() => go("requests")} label={t("Demandes", "Requests")} icon={<IconInbox />} badge={waiting} />
        <TabButton active={tab === "spend"} onClick={() => go("spend")} label={t("Dépenser", "Spend")} icon={<IconSpend />} />
        <TabButton active={tab === "more"} onClick={() => go("more")} label={t("Plus", "More")} icon={<IconMore />} />
      </nav>
    </div>
  );
}

function TabButton({ active, onClick, label, icon, badge = 0 }: { active: boolean; onClick: () => void; label: string; icon: ReactNode; badge?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-14 flex-col items-center justify-center gap-1 rounded-[10px] text-[11px] font-medium transition-colors ${active ? "text-text" : "text-text-3 hover:text-text-2"}`}
    >
      <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${active ? "bg-raise" : ""}`}>{icon}</span>
      {label}
      {badge > 0 ? (
        <span className="absolute right-[18%] top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 font-mono text-[10px] text-on-brand">{badge}</span>
      ) : null}
    </button>
  );
}

const iconProps = { viewBox: "0 0 20 20", className: "size-[18px]", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function IconFund() {
  return (
    <svg aria-hidden {...iconProps}>
      <rect x="2.5" y="5" width="15" height="11" rx="3.5" />
      <circle cx="7.5" cy="10.5" r="1.3" />
      <circle cx="12.5" cy="10.5" r="1.3" />
    </svg>
  );
}
function IconInbox() {
  return (
    <svg aria-hidden {...iconProps}>
      <path d="M3 11.5 5 4.5h10l2 7v4h-14z" />
      <path d="M3 11.5h4l1 2h4l1-2h4" />
    </svg>
  );
}
function IconSpend() {
  return (
    <svg aria-hidden {...iconProps}>
      <path d="M10 15V5m0 0-3.5 3.5M10 5l3.5 3.5" />
      <path d="M4 16.5h12" />
    </svg>
  );
}
function IconMore() {
  return (
    <svg aria-hidden {...iconProps}>
      <circle cx="5" cy="10" r="1" fill="currentColor" />
      <circle cx="10" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}
