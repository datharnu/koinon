import { wrapEvent, unwrapEvent } from "nostr-tools/nip17";
import { getPublicKey, generateSecretKey } from "nostr-tools/pure";
import { SimplePool } from "nostr-tools/pool";
import { encodeMessage, parseMessage, type KoinonMessage, type ParsedMessage } from "./schema.js";

const GIFT_WRAP = 1059;

export interface NostrIdentity {
  secretKey: Uint8Array;
  publicKey: string;
}

export function createIdentity(): NostrIdentity {
  const secretKey = generateSecretKey();
  return { secretKey, publicKey: getPublicKey(secretKey) };
}

export function openPool(): SimplePool {
  return new SimplePool({ enablePing: false, enableReconnect: false });
}

/** One NIP-17 gift wrap to one officer. The plaintext is the JSON message and nothing else. */
export async function publishMessage(args: {
  pool: SimplePool;
  relayUrl: string;
  sender: Uint8Array;
  recipientPublicKey: string;
  message: KoinonMessage;
}): Promise<void> {
  const wrapped = wrapEvent(args.sender, { publicKey: args.recipientPublicKey }, encodeMessage(args.message));
  await Promise.all(args.pool.publish([args.relayUrl], wrapped));
}

export async function giftWrapContents(args: {
  pool: SimplePool;
  relayUrl: string;
  recipientPublicKey: string;
  maxWaitMs?: number;
}): Promise<string[]> {
  const events = await args.pool.querySync(
    [args.relayUrl],
    { kinds: [GIFT_WRAP], "#p": [args.recipientPublicKey] },
    { maxWait: args.maxWaitMs ?? 4_000 },
  );
  return events.map((event) => event.content);
}

export async function readMessages(args: {
  pool: SimplePool;
  relayUrl: string;
  recipient: NostrIdentity;
  maxWaitMs?: number;
}): Promise<ParsedMessage[]> {
  const events = await args.pool.querySync(
    [args.relayUrl],
    { kinds: [GIFT_WRAP], "#p": [args.recipient.publicKey] },
    { maxWait: args.maxWaitMs ?? 4_000 },
  );
  return events.map((event) => {
    try {
      const rumor = unwrapEvent(event, args.recipient.secretKey);
      return parseMessage(rumor.content);
    } catch {
      return { kind: "ignored", reason: "invalid" } as const;
    }
  });
}
