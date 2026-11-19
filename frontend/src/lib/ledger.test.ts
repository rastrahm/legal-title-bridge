import { describe, expect, it } from "vitest";

import { computeEntryHash, verifyLedgerChain } from "./ledger";

const ZERO =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

describe("verifyLedgerChain", () => {
  it("accepts an intact chain", () => {
    const h0 = computeEntryHash(ZERO, "a");
    const h1 = computeEntryHash(h0, "b");
    const r = verifyLedgerChain([
      { entryHash: h0, prevHash: ZERO, data: "a" },
      { entryHash: h1, prevHash: h0, data: "b" },
    ]);
    expect(r.ok).toBe(true);
    expect(r.breakAt).toBe(-1);
  });

  it("reports the index where the chain breaks", () => {
    const h0 = computeEntryHash(ZERO, "a");
    const r = verifyLedgerChain([
      { entryHash: h0, prevHash: ZERO, data: "a" },
      { entryHash: "0xdead", prevHash: h0, data: "b" },
    ]);
    expect(r.ok).toBe(false);
    expect(r.breakAt).toBe(1);
  });
});
