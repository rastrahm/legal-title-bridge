import { describe, expect, it } from "vitest";

import { buildAssertionTypedData } from "./identity";

describe("buildAssertionTypedData", () => {
  it("binds LegalTitleBridge domain and Assertion fields", () => {
    const td = buildAssertionTypedData(
      "0x2525Db5706d4547B93cF2b608c9809bE2a887EE9",
      11155111,
      {
        holder:
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        country: 724,
        investorType: 1,
        expiry: 2_000_000_000,
      },
    );
    expect(td.domain.name).toBe("LegalTitleBridge");
    expect(td.domain.chainId).toBe(11155111);
    expect(td.primaryType).toBe("Assertion");
    expect(td.message.country).toBe(724);
  });
});
