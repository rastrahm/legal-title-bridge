import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/wallets/env", () => ({
  isE2eLab: vi.fn(() => false),
}));

vi.mock("@/lib/config/network", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/config/network")>(
      "@/lib/config/network",
    );
  return {
    ...actual,
    getActiveNetwork: vi.fn(() => actual.SEPOLIA_DEVNET_NETWORK),
  };
});

import { getActiveNetwork } from "@/lib/config/network";
import { isE2eLab } from "@/lib/wallets/env";
import { useDemoPurchasePath } from "./purchase";

describe("useDemoPurchasePath", () => {
  afterEach(() => {
    vi.mocked(isE2eLab).mockReset();
    vi.mocked(getActiveNetwork).mockReset();
  });

  it("never uses silent demo on sepolia-devnet", async () => {
    const { SEPOLIA_DEVNET_NETWORK } = await import("@/lib/config/network");
    vi.mocked(getActiveNetwork).mockReturnValue(SEPOLIA_DEVNET_NETWORK);
    vi.mocked(isE2eLab).mockReturnValue(true);
    expect(useDemoPurchasePath()).toBe(false);
  });

  it("allows demo when E2E lab on local network", async () => {
    const { LOCAL_NETWORK } = await import("@/lib/config/network");
    vi.mocked(getActiveNetwork).mockReturnValue(LOCAL_NETWORK);
    vi.mocked(isE2eLab).mockReturnValue(true);
    expect(useDemoPurchasePath()).toBe(true);
  });
});
