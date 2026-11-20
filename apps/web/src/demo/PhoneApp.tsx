import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { OfficerRole } from "../lib/flows";
import { usePrefs } from "../lib/prefs";
import { IconGear, IconHome, IconInbox } from "../ui/icons";
import { useOfficerRequests } from "./hooks";
import { HomeScreen } from "./HomeScreen";
import { RecoveryScreen } from "./Network";
import { RequestScreen } from "./RequestScreen";
import { RequestsScreen } from "./RequestsScreen";
import { SettingsScreen, MembersScreen, ActivityScreen } from "./SettingsScreen";
import { SpendScreen } from "./SpendScreen";
import { useStage } from "./stage";
import { NavContext, type Route, type Tab } from "./ui";

/** One officer's phone: tab roots with a bottom bar, pushed screens without it. */
export function PhoneApp({ role, initial = "home" }: { role: OfficerRole; initial?: Tab }) {
  const [stack, setStack] = useState<Route[]>([{ name: initial }]);
  const [sheet, setSheet] = useState<ReactNode | null>(null);

  const push = useCallback((route: Route) => setStack((current) => [...current, route]), []);
  const back = useCallback(() => setStack((current) => (current.length > 1 ? current.slice(0, -1) : current)), []);
  const tab = useCallback((next: Tab) => setStack([{ name: next }]), []);
  const nav = useMemo(() => ({ push, back, tab, sheet: setSheet }), [push, back, tab]);

  const focus = useStage()?.focus;
  useEffect(() => {
    if (!focus || focus.role !== role) return;
    setSheet(null);
    setStack([{ name: "requests" }, { name: "request", id: focus.requestId }]);
  }, [focus, role]);

  const route = stack[stack.length - 1] ?? { name: "home" };
  const root = stack.length === 1;

  return (
    <NavContext.Provider value={nav}>
      <div className="relative flex min-h-0 flex-1 flex-col bg-surface">
        <div key={`${stack.length}-${route.name}`} className={`flex min-h-0 flex-1 flex-col ${root ? "" : "screen-in"}`}>
          <Screen role={role} route={route} />
        </div>
        {root ? <BottomBar role={role} current={route.name as Tab} onTab={tab} /> : null}
        {sheet}
      </div>
    </NavContext.Provider>
  );
}

function Screen({ role, route }: { role: OfficerRole; route: Route }) {
  switch (route.name) {
    case "home":
      return <HomeScreen role={role} />;
    case "requests":
      return <RequestsScreen role={role} />;
    case "settings":
      return <SettingsScreen role={role} />;
    case "spend":
      return <SpendScreen role={role} />;
    case "request":
      return <RequestScreen role={role} id={route.id} />;
    case "members":
      return <MembersScreen />;
    case "recovery":
      return <RecoveryScreen role={role} />;
    case "activity":
      return <ActivityScreen />;
  }
}

function BottomBar({ role, current, onTab }: { role: OfficerRole; current: Tab; onTab: (tab: Tab) => void }) {
  const { t } = usePrefs();
  const { toSign } = useOfficerRequests(role);
  const items: { id: Exclude<Tab, "settings">; label: string; icon: ReactNode; badge?: number }[] = [
    { id: "home", label: t("Accueil", "Home"), icon: <IconHome size={20} /> },
    { id: "requests", label: t("Demandes", "Requests"), icon: <IconInbox size={20} />, badge: toSign.length },
  ];
  return (
    <nav aria-label={t("Navigation", "Navigation")} className="flex shrink-0 items-center gap-2 bg-surface px-4 pb-[max(env(safe-area-inset-bottom),14px)] pt-2">
      <div className="flex flex-1 items-center gap-1 rounded-full bg-card p-1">
        {items.map((item) => {
          const active = current === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onTab(item.id)}
              className={`press relative flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-[14px] font-semibold transition-colors ${
                active ? "bg-surface text-ink shadow-[0_2px_8px_-3px_rgb(0_0_0/0.18)]" : "text-ink-3 hover:text-ink"
              }`}
            >
              <span className={active ? "text-brand" : ""}>{item.icon}</span>
              {item.label}
              {item.badge ? (
                <span className="tabular grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-on-brand" aria-label={t(`${item.badge} à signer`, `${item.badge} to sign`)}>
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        aria-label={t("Réglages", "Settings")}
        aria-current={current === "settings" ? "page" : undefined}
        onClick={() => onTab("settings")}
        className={`press grid size-[52px] shrink-0 place-items-center rounded-full transition-colors ${current === "settings" ? "bg-ink text-surface" : "bg-card text-ink-2 hover:text-ink"}`}
      >
        <IconGear size={21} />
      </button>
    </nav>
  );
}
