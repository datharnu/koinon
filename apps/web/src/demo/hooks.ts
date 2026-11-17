import type { Role } from "@koinon/core";
import type { ParsedMessage, SpendRequestMessage } from "@koinon/nostr";
import { useQuery } from "@tanstack/react-query";
import { endpoints } from "../lib/api";
import { inbox } from "../lib/flows";
import { myRequests, type FundConfig, type Secret } from "../lib/vault";

export function useFund(fundId: string) {
  return useQuery({ queryKey: ["fund", fundId], queryFn: () => endpoints.fund(fundId), refetchInterval: 3_000 });
}

export function useLedger(fundId: string) {
  return useQuery({ queryKey: ["ledger", fundId], queryFn: () => endpoints.ledger(fundId), refetchInterval: 3_000 });
}

export function useMembers(fundId: string) {
  return useQuery({ queryKey: ["members", fundId], queryFn: () => endpoints.members(fundId), staleTime: 30_000 });
}

export function useRequest(id: string) {
  return useQuery({
    queryKey: ["request", id],
    queryFn: () => endpoints.request(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "confirmed" || status === "rejected" || status === "expired" || status === "failed" ? false : 2_500;
    },
  });
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
      const parsed: ParsedMessage[] = await inbox(secret, publicKey);
      const items = new Map<string, InboxItem>();
      if (role !== "K") {
        for (const id of myRequests(role)) items.set(id, { requestId: id, mine: true });
      }
      for (const entry of parsed) {
        if (entry.kind !== "request" || entry.message.fund_id !== config.fundId) continue;
        if (!items.has(entry.message.request_id)) items.set(entry.message.request_id, { requestId: entry.message.request_id, message: entry.message, mine: false });
      }
      const replies = parsed.filter((entry) => entry.kind === "approval" || entry.kind === "rejection");
      return { items: [...items.values()], replies };
    },
    refetchInterval: 3_000,
    placeholderData: (previous) => previous,
  });
}
