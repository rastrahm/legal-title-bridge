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
import {
  closeDvPWithPhantom,
  isSolanaPubkey,
  sellerPrepareDvPHandoff,
  useDemoPurchasePath,
} from "./purchase";

const SELLER = "EDTzyw3P2wwaLu9VyFUs5EjXziCHaSXCQkbJWhDwM4x5";
const BUYER = "7EcDhSYGxXyscszYEp35KHN8vvw3svRhLNvn5Lf2Sq5H";

describe("isSolanaPubkey", () => {
  it("accepts a valid base58 pubkey", () => {
    expect(isSolanaPubkey(SELLER)).toBe(true);
  });

  it("rejects garbage", () => {
    expect(isSolanaPubkey("not-a-pubkey")).toBe(false);
    expect(isSolanaPubkey("")).toBe(false);
  });
});

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

describe("DvP party guards", () => {
  it("rejects lab example pubkeys / self-buy before Phantom", async () => {
    await expect(
      sellerPrepareDvPHandoff({
        seller: "seller-lab",
        buyer: BUYER,
        titleAmount: "10",
        paymentAmount: "10",
        assetIdHex: `0x${"aa".repeat(32)}`,
        offerTransferId: "0x1",
      }),
    ).rejects.toThrow(/pubkeys Solana/);

    await expect(
      closeDvPWithPhantom({
        seller: SELLER,
        buyer: SELLER,
        titleAmount: "10",
        paymentAmount: "10",
        assetIdHex: `0x${"aa".repeat(32)}`,
      }),
    ).rejects.toThrow(/misma|vos mismo|yourself|contraparte/i);
  });
});
