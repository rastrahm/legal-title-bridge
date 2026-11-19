import { describe, expect, it } from "vitest";

import { PLACEHOLDER_ETHEREUM_ADDRESS } from "@/vendor/shared";

import { isConfiguredBridgeEndpoint, resolveAddresses } from "./addresses";

describe("resolveAddresses (D14/W3)", () => {
  it("ignores URL endpoint injection", () => {
    const a = resolveAddresses("local", {
      endpoint: "0xAtaaaaaaaaaccccccccccccccccccccccccccc",
      program: "EvilProgram111111111111111111111111111",
    });
    expect(a.bridgeEndpoint).toBe(PLACEHOLDER_ETHEREUM_ADDRESS);
    expect(a.solana).toBe("11111111111111111111111111111111");
  });

  it("matches configured bridge endpoint case-insensitively", () => {
    expect(
      isConfiguredBridgeEndpoint(PLACEHOLDER_ETHEREUM_ADDRESS.toUpperCase()),
    ).toBe(true);
    expect(
      isConfiguredBridgeEndpoint("0x1111111111111111111111111111111111111111"),
    ).toBe(false);
  });
});
