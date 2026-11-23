import { describe, expect, it } from "vitest";

import { formatRegistryError } from "./registry-errors";

describe("formatRegistryError", () => {
  it("decodes AssetNotActive from CALL_EXCEPTION data", () => {
    const msg = formatRegistryError(
      new Error(
        'execution reverted (unknown custom error) (action="call", data="0xf558e2dbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab", reason=null, code=CALL_EXCEPTION, version=6.17.0)',
      ),
    );
    expect(msg).toContain("AssetNotActive");
    expect(msg).toContain("createAsset");
  });

  it("decodes CertificationExpired selector", () => {
    const msg = formatRegistryError(
      new Error(
        'execution reverted (action="call", data="0x1747fddfaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", code=CALL_EXCEPTION)',
      ),
    );
    expect(msg).toContain("CertificationExpired");
  });

  it("decodes NotVerified selector", () => {
    const msg = formatRegistryError(
      new Error(
        'execution reverted (action="call", data="0xc2f4d617bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", code=CALL_EXCEPTION)',
      ),
    );
    expect(msg).toContain("NotVerified");
  });
});
