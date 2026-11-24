import { concat, keccak256 } from "ethers";
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

  it("matches Solidity LedgerChain when data is bytes32 dataHash", () => {
    const dataHash =
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const expected = keccak256(
      concat([ZERO as `0x${string}`, dataHash as `0x${string}`]),
    );
    expect(computeEntryHash(ZERO, dataHash)).toBe(expected);
    const r = verifyLedgerChain([
      { entryHash: expected, prevHash: ZERO, data: dataHash },
    ]);
    expect(r.ok).toBe(true);
  });
});
