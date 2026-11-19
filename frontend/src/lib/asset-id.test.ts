import { describe, expect, it } from "vitest";

import { parseAssetId } from "./asset-id";

describe("parseAssetId", () => {
  it("accepts bytes32 hex", () => {
    const id =
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    expect(parseAssetId(id)).toBe(id);
    expect(parseAssetId("nope")).toBeNull();
  });
});
