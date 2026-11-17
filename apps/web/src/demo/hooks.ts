import type { Role } from "@koinon/core";
import type { SpendRequestMessage } from "@koinon/nostr";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { endpoints, type RequestView } from "../lib/api";
import { inbox } from "../lib/flows";
import { myRequests, type FundConfig, type Secret } from "../lib/vault";
import { useDemo } from "./context";

export function useFund(fundId: string) {
  return useQuery({ queryKey: ["fund", fundId], queryFn: () => endpoints.fund(fundId), refetchInterval: 3_000 });
}

export function useLedger(fundId: string) {
  return useQuery({ queryKey: ["ledger", fundId], queryFn: () => endpoints.ledger(fundId), refetchInterval: 3_000 });
}

export function useMembers(fundId: string) {
  return useQuery({ queryKey: ["members", fundId], queryFn: () => endpoints.members(fundId), staleTime: 30_000 });
}

const settled = new Set(["confirmed", "rejected", "expired", "failed"]);

function requestQuery(id: string) {
  return {
    queryKey: ["request", id],
    queryFn: () => endpoints.request(id),
    refetchInterval: (query: { state: { data?: RequestView } }) => (query.state.data && settled.has(query.state.data.status) ? false : 2_500),
  };
}

export function useRequest(id: string) {
  return useQuery(requestQuery(id));
}

export interface InboxItem {
  requestId: string;
  /** What this officer read in the gift wrap. Absent for requests this officer opened. */
  message?: SpendRequestMessage;
  mine: boolean;
}

/** The officer's inbox is the relay: gift wraps addressed to their Nostr key, unwrapped here. */
export function useInbox(config: FundConfig, role: Role, secret: Secret, pulse: number) {
  const publicKey = role === "K" ? config.assembly.nostrPub : config.officers[role].nostrPub;
  return useQuery({
    queryKey: ["inbox", config.fundId, role, pulse],
    queryFn: async () => {
      const parsed = await inbox(secret, publicKey);
      const items = new Map<string, InboxItem>();
      if (role !== "K") {
        for (const id of myRequests(role)) items.set(id, { requestId: id, mine: true });
      }
      for (const entry of parsed) {
        if (entry.kind !== "request" || entry.message.fund_id !== config.fundId) continue;
        if (!items.has(entry.message.request_id)) items.set(entry.message.request_id, { requestId: entry.message.request_id, message: entry.message, mine: false });
      }
      return [...items.values()];
    },
    refetchInterval: 3_000,
    placeholderData: (previous) => previous,
  });
}

export type RequestBucket = "sign" | "open" | "done";

export interface RequestEntry {
  item: InboxItem;
  request?: RequestView;
  bucket: RequestBucket;
}

/** Every request this officer can see, with its live status, newest first. */
export function useOfficerRequests(role: Role) {
  const demo = useDemo();
  const inboxQuery = useInbox(demo.config, role, demo.secrets[role], demo.pulse);
  const items = inboxQuery.data ?? [];
  const results = useQueries({ queries: items.map((item) => requestQuery(item.requestId)) });
  const entries: RequestEntry[] = items.map((item, index) => {
    const request = results[index]?.data;
    return { item, request, bucket: bucketOf(request, role) };
  });
  entries.sort((a, b) => (b.request?.created_at ?? "9").localeCompare(a.request?.created_at ?? "9"));
  return { inbox: inboxQuery, entries, toSign: entries.filter((entry) => entry.bucket === "sign" && !entry.item.mine) };
}

export function bucketOf(request: RequestView | undefined, role: Role): RequestBucket {
  if (!request) return "open";
  if (settled.has(request.status)) return "done";
  const open = request.status === "pending" || request.status === "draft";
  if (open && !request.approvals.some((approval) => approval.officer === role)) return "sign";
  return "open";
}

export function useRefresh() {
  const demo = useDemo();
  const client = useQueryClient();
  return async (requestId?: string) => {
    demo.touch();
    await Promise.all([
      requestId ? client.invalidateQueries({ queryKey: ["request", requestId] }) : client.invalidateQueries({ queryKey: ["request"] }),
      client.invalidateQueries({ queryKey: ["fund", demo.config.fundId] }),
      client.invalidateQueries({ queryKey: ["ledger", demo.config.fundId] }),
    ]);
  };
}
