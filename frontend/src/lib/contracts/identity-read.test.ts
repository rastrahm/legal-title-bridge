import { beforeEach, describe, expect, it, vi } from "vitest";

const isVerified = vi.fn();

vi.mock("@/lib/eth-rpc", () => ({
  getReadOnlyEthProvider: vi.fn(() => ({})),
}));

vi.mock("ethers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ethers")>();
  class MockContract {
    isVerified = isVerified;
  }
  return {
    ...actual,
    Contract: MockContract,
  };
});

import { readIsVerified } from "./identity-read";

const IDENTITY = "0x2525Db5706d4547B93cF2b608c9809bE2a887EE9";
const HOLDER =
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("readIsVerified", () => {
  beforeEach(() => {
    isVerified.mockReset();
  });

  it("returns verified when registry says true", async () => {
    isVerified.mockResolvedValue(true);
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
});
