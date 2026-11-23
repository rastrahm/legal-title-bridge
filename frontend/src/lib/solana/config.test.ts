import { describe, expect, it } from "vitest";

import { assetIdBytes, DEVNET_ASSET_ID_HEX } from "./config";

describe("assetIdBytes", () => {
  it("parses demo asset id to 32 bytes", () => {
    const b = assetIdBytes(DEVNET_ASSET_ID_HEX);
    expect(b).toHaveLength(32);
    expect(b[0]).toBe(0xaa);
    expect(b[31]).toBe(0xaa);
  });

  it("rejects bad length", () => {
    expect(() => assetIdBytes("0xab")).toThrow(/32 bytes/);
  });
});
