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
import type { FundConfig } from "../lib/vault";

export type Fingerprint = "missing" | "invalid" | "match" | "mismatch" | "phone";

export function constitutionOf(fund: FundView): Constitution | null {
  const by = Object.fromEntries(fund.officers.map((officer) => [officer.role, officer.xpub]));
  const o1 = by.O1;
  const o2 = by.O2;
  const o3 = by.O3;
  if (!o1 || !o2 || !o3 || !fund.assembly?.xpub || !Number.isInteger(fund.csv_blocks)) return null;
  return { officers: [o1, o2, o3], assembly: fund.assembly.xpub, csvBlocks: fund.csv_blocks };
}

/** Hash of the keys this browser created. The member link puts the same hash after #. */
export function localFingerprint(config: FundConfig): string | null {
  try {
    return constitutionHash({
      officers: [config.officers.O1.xpub, config.officers.O2.xpub, config.officers.O3.xpub],
      assembly: config.assembly.xpub,
      csvBlocks: config.csvBlocks,
    });
  } catch {
    return null;
  }
}

export function fingerprintStatus(fund: FundView, fragment: string, localHash?: string | null): Fingerprint {
  const keys = constitutionOf(fund);
  if (!keys) return "mismatch";
  let serverHash: string;
  try {
    serverHash = constitutionHash(keys);
  } catch {
    return "mismatch";
  }
  if (!fragment) {
    if (!localHash) return "missing";
    return localHash === serverHash ? "phone" : "mismatch";
  }
  if (!/^[0-9a-f]{64}$/i.test(fragment)) return "invalid";
  return serverHash === fragment.toLowerCase() ? "match" : "mismatch";
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
