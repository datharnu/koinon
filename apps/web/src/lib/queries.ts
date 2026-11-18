import { useQuery } from "@tanstack/react-query";
import { endpoints, type RequestView } from "./http";

const settled = new Set(["confirmed", "rejected", "expired", "failed"]);

export function useFund(fundId: string) {
  return useQuery({ queryKey: ["fund", fundId], queryFn: () => endpoints.fund(fundId), refetchInterval: 3_000 });
}

export function useLedger(fundId: string) {
  return useQuery({ queryKey: ["ledger", fundId], queryFn: () => endpoints.ledger(fundId), refetchInterval: 3_000 });
}

export function useMembers(fundId: string) {
  return useQuery({ queryKey: ["members", fundId], queryFn: () => endpoints.members(fundId), staleTime: 30_000 });
}

export function requestQuery(id: string) {
  return {
    queryKey: ["request", id],
    queryFn: () => endpoints.request(id),
    refetchInterval: (query: { state: { data?: RequestView } }) => (query.state.data && settled.has(query.state.data.status) ? false : 2_500),
  };
}

export function useRequest(id: string) {
  return useQuery(requestQuery(id));
}
