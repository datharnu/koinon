import { describe, expect, it } from "vitest";
import { parseMessage } from "../src/schema.js";
import { proveNostr } from "../src/scenario.js";

describe("nostr messages", () => {
  it("ignores an unknown type", () => {
    expect(parseMessage(JSON.stringify({ type: "chat.hello", text: "bonjour" }))).toEqual({
      kind: "ignored",
      reason: "unknown",
    });
  });

  it("delivers a private request and refuses a swapped psbt before approving", async () => {
    const result = await proveNostr();
    expect(result.lines.filter((line) => line.startsWith("FAIL"))).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
