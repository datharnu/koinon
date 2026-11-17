import { z } from "zod";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const isoTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/);
const officer = z.enum(["O1", "O2", "O3", "K"]);

/** The request the officer reads. There is no PSBT field. Path is required so the signer checks the right sequence. */
export const spendRequestSchema = z.object({
  type: z.literal("koinon.spend_request.v1"),
  request_id: uuid,
  fund_id: uuid,
  amount_xof: z.number().int().positive().max(1_000_000_000_000),
  amount_sats: z.string().regex(/^[1-9]\d*$/),
  recipient: z.string().min(10).max(120),
  purpose: z.string().trim().min(1).max(140),
  expires_at: isoTime,
  coordinator_url: z.url().max(200),
  path: z.enum(["A", "B"]),
});

export const spendApprovalSchema = z.object({
  type: z.literal("koinon.spend_approval.v1"),
  request_id: uuid,
  fund_id: uuid,
  officer,
});

export const spendRejectionSchema = z.object({
  type: z.literal("koinon.spend_rejection.v1"),
  request_id: uuid,
  fund_id: uuid,
  officer,
  reason: z.string().trim().min(1).max(140),
});

export type SpendRequestMessage = z.infer<typeof spendRequestSchema>;
export type SpendApprovalMessage = z.infer<typeof spendApprovalSchema>;
export type SpendRejectionMessage = z.infer<typeof spendRejectionSchema>;
export type KoinonMessage = SpendRequestMessage | SpendApprovalMessage | SpendRejectionMessage;

const known = z.discriminatedUnion("type", [spendRequestSchema, spendApprovalSchema, spendRejectionSchema]);

export type ParsedMessage =
  | { kind: "request"; message: SpendRequestMessage }
  | { kind: "approval"; message: SpendApprovalMessage }
  | { kind: "rejection"; message: SpendRejectionMessage }
  | { kind: "ignored"; reason: "unknown" | "invalid" };

/** Unknown types are ignored. A malformed known type is ignored too, so one bad event does not stop the client. */
export function parseMessage(raw: string): ParsedMessage {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { kind: "ignored", reason: "invalid" };
  }
  if (!value || typeof value !== "object" || !("type" in value) || typeof value.type !== "string") {
    return { kind: "ignored", reason: "invalid" };
  }
  if (!value.type.startsWith("koinon.")) {
    return { kind: "ignored", reason: "unknown" };
  }
  const parsed = known.safeParse(value);
  if (!parsed.success) return { kind: "ignored", reason: "invalid" };
  if (parsed.data.type === "koinon.spend_request.v1") return { kind: "request", message: parsed.data };
  if (parsed.data.type === "koinon.spend_approval.v1") return { kind: "approval", message: parsed.data };
  return { kind: "rejection", message: parsed.data };
}

export function encodeMessage(message: KoinonMessage): string {
  return JSON.stringify(known.parse(message));
}

export function requestExpired(message: SpendRequestMessage, now: Date): boolean {
  const expires = Date.parse(message.expires_at);
  if (Number.isNaN(expires)) return true;
  return expires <= now.getTime();
}
