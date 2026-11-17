import {
  KoinonError,
  psbtFromBase64,
  signVerifiedSpend,
  type Role,
  type SpendApproval,
} from "@koinon/core";
import { requestExpired, type SpendApprovalMessage, type SpendRequestMessage } from "./schema.js";

export type SpendDecision =
  | { action: "ignored"; reason: "expired" | "wrong-coordinator" }
  | { action: "refused"; code: string }
  | { action: "approve"; message: SpendApprovalMessage; signedPsbt: string };

/**
 * The officer read `message`. The PSBT is loaded from the coordinator they already trust.
 * A different URL in the message is ignored. A mismatch refuses the signature and does not
 * build an approval. The approval message does not carry the PSBT.
 */
export async function decideSpend(args: {
  message: SpendRequestMessage;
  now: Date;
  coordinatorUrl: string;
  officer: Role;
  mnemonic: string;
  fund: Omit<SpendApproval, "recipient" | "amount" | "mode">;
  loadPsbt: (requestId: string) => Promise<string>;
}): Promise<SpendDecision> {
  if (!sameCoordinator(args.message.coordinator_url, args.coordinatorUrl)) {
    return { action: "ignored", reason: "wrong-coordinator" };
  }
  if (requestExpired(args.message, args.now)) {
    return { action: "ignored", reason: "expired" };
  }
  try {
    const base64 = await args.loadPsbt(args.message.request_id);
    const psbt = psbtFromBase64(base64, args.fund.network);
    const signed = signVerifiedSpend({
      ...args.fund,
      recipient: args.message.recipient,
      amount: BigInt(args.message.amount_sats),
      mode: args.message.path === "B" ? "path-b" : "path-a",
      psbt,
      mnemonic: args.mnemonic,
    });
    return {
      action: "approve",
      signedPsbt: signed.psbt.toBase64(),
      message: {
        type: "koinon.spend_approval.v1",
        request_id: args.message.request_id,
        fund_id: args.message.fund_id,
        officer: args.officer,
      },
    };
  } catch (error) {
    if (error instanceof KoinonError) return { action: "refused", code: error.code };
    return { action: "refused", code: "VALIDATION" };
  }
}

function sameCoordinator(left: string, right: string): boolean {
  try {
    const a = new URL(left);
    const b = new URL(right);
    const path = (value: string) => value.replace(/\/$/, "");
    return a.origin === b.origin && path(a.pathname) === path(b.pathname);
  } catch {
    return false;
  }
}
