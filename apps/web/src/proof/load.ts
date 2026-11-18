import {
  checkAddresses,
  constitutionHash,
  inspectTransaction,
  type Constitution,
  type Inspection,
  type ProofRole,
} from "@koinon/core/proof";
import { useQuery } from "@tanstack/react-query";
import { endpoints, type FundView, type TxProof } from "../lib/http";
import { useFund, useMembers } from "../lib/queries";

export type Fingerprint = "missing" | "invalid" | "match" | "mismatch";

export function constitutionOf(fund: FundView): Constitution | null {
  const by = Object.fromEntries(fund.officers.map((officer) => [officer.role, officer.xpub]));
  const o1 = by.O1;
  const o2 = by.O2;
  const o3 = by.O3;
  if (!o1 || !o2 || !o3 || !fund.assembly?.xpub || !Number.isInteger(fund.csv_blocks)) return null;
  return { officers: [o1, o2, o3], assembly: fund.assembly.xpub, csvBlocks: fund.csv_blocks };
}

export function fingerprintStatus(fund: FundView, fragment: string): Fingerprint {
  const keys = constitutionOf(fund);
  if (!keys) return "mismatch";
  if (!fragment) return "missing";
  if (!/^[0-9a-f]{64}$/i.test(fragment)) return "invalid";
  try {
    return constitutionHash(keys) === fragment.toLowerCase() ? "match" : "mismatch";
  } catch {
    return "mismatch";
  }
}

export function addressCheck(fund: FundView, members: { index: number; address: string }[]) {
  const keys = constitutionOf(fund);
  if (!keys) return null;
  try {
    return checkAddresses(keys, members, fund.change_address);
  } catch {
    return null;
  }
}

export interface LoadedProof {
  inspection: Inspection;
  confirmations: number | null;
  reportedKind: TxProof["kind"];
}

export async function loadInspection(fund: FundView, indexes: number[], txid: string): Promise<LoadedProof> {
  const keys = constitutionOf(fund);
  if (!keys) throw new Error("KEYS");
  const proof = await endpoints.proof(fund.id, txid);
  const first = inspectTransaction({ hex: proof.hex, keys, indexes });
  const parents: { txid: string; hex: string }[] = [];
  for (const input of first.inputs) {
    try {
      const parent = await endpoints.proof(fund.id, input.txid);
      parents.push({ txid: input.txid, hex: parent.hex });
    } catch {
      // The parent is not a transaction this fund recorded. The value stays unknown.
    }
  }
  const inspection = parents.length === 0 ? first : inspectTransaction({ hex: proof.hex, keys, indexes, parents });
  return { inspection, confirmations: proof.confirmations, reportedKind: proof.kind };
}

export function useInspection(fundId: string, txid: string | null) {
  const fund = useFund(fundId);
  const members = useMembers(fundId);
  const indexes = members.data?.members.map((member) => member.index) ?? [];
  return useQuery({
    queryKey: ["proof", fundId, txid, indexes.join(",")],
    enabled: Boolean(txid && fund.data && members.data),
    queryFn: () => loadInspection(fund.data as FundView, indexes, txid as string),
    staleTime: 30_000,
  });
}

export function labelFor(fund: FundView, role: ProofRole): string {
  if (role === "K") return fund.assembly.label;
  return fund.officers.find((officer) => officer.role === role)?.label ?? role;
}
