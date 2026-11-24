import { beforeEach, describe, expect, it, vi } from "vitest";

const isVerified = vi.fn();
const getAssertion = vi.fn();

vi.mock("@/lib/eth-rpc", () => ({
  getReadOnlyEthProvider: vi.fn(() => ({})),
}));

vi.mock("ethers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ethers")>();
  class MockContract {
    isVerified = isVerified;
    getAssertion = getAssertion;
  }
  return {
    ...actual,
    Contract: MockContract,
  };
});

import { addresses } from "@/vendor/shared";

import { readIsVerified, readVerificationDetail } from "./identity-read";

const IDENTITY = addresses["sepolia-devnet"].identityRegistry;
const HOLDER =
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const ZERO =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

describe("readIsVerified", () => {
  beforeEach(() => {
    isVerified.mockReset();
    getAssertion.mockReset();
    getAssertion.mockResolvedValue({ holder: ZERO, expiry: 0n });
  });

  it("returns verified when registry says true", async () => {
    isVerified.mockResolvedValue(true);
    getAssertion.mockResolvedValue({ holder: HOLDER, expiry: 99n });
    await expect(readIsVerified(IDENTITY, HOLDER)).resolves.toBe("verified");
  });

  it("returns unverified when registry says false", async () => {
    isVerified.mockResolvedValue(false);
    await expect(readIsVerified(IDENTITY, HOLDER)).resolves.toBe("unverified");
  });

  it("returns unknown when RPC throws", async () => {
    isVerified.mockRejectedValue(new Error("network down"));
    await expect(readIsVerified(IDENTITY, HOLDER)).resolves.toBe("unknown");
  });

  it("readVerificationDetail reports missing assertion", async () => {
    isVerified.mockResolvedValue(false);
    getAssertion.mockResolvedValue({ holder: ZERO, expiry: 0n });
    await expect(readVerificationDetail(IDENTITY, HOLDER)).resolves.toEqual({
      status: "unverified",
      hasAssertion: false,
      expiry: null,
    });
  });
});
