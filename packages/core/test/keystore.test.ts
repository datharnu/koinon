import { describe, expect, it } from "vitest";
import { decryptKey, encryptKey } from "../src/keystore.js";

const marker = "koinon-plaintext-marker";

describe("key encryption", () => {
  it("round-trips and keeps the plaintext out of the file", async () => {
    const file = await encryptKey(new TextEncoder().encode(marker), "correct-pin");
    const encoded = JSON.stringify(file);
    expect(encoded).not.toContain(marker);
    expect(file.iterations).toBeGreaterThanOrEqual(310_000);
    const plain = await decryptKey(file, "correct-pin");
    expect(new TextDecoder().decode(plain)).toBe(marker);
  });

  it("refuses the wrong pin", async () => {
    const file = await encryptKey(new TextEncoder().encode(marker), "correct-pin");
    await expect(decryptKey(file, "wrong-pin-1")).rejects.toThrow(/wrong pin/);
  });
});
