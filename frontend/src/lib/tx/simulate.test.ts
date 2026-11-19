import { describe, expect, it } from "vitest";

import { simulateTransaction } from "./simulate";

describe("simulateTransaction", () => {
  it("returns ok on successful eth_call", async () => {
    const r = await simulateTransaction(
      { call: async () => "0x01" },
      { to: "0x0000000000000000000000000000000000000001" },
    );
    expect(r.ok).toBe(true);
  });

  it("returns error on failure", async () => {
    const r = await simulateTransaction(
      {
        call: async () => {
          throw new Error("revert");
        },
      },
      { to: "0x0000000000000000000000000000000000000001" },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("revert");
  });
});
