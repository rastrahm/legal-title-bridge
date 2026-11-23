import { beforeEach, describe, expect, it, vi } from "vitest";

const assetState = vi.fn();
const isCertified = vi.fn();
const isVerified = vi.fn();
const getBlockNumber = vi.fn();
const getLogs = vi.fn();

vi.mock("@/lib/eth-rpc", () => ({
  getReadOnlyEthProvider: vi.fn(() => ({
    getBlockNumber,
    getLogs,
  })),
}));

vi.mock("ethers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ethers")>();
  class MockContract {
    assetState = assetState;
    isCertified = isCertified;
    isVerified = isVerified;
    totalIssued = vi.fn(async () => 1000n);
    circulating = vi.fn(async () => 1000n);
    entryCount = vi.fn(async () => 0n);
    verifyLedger = vi.fn(async () => true);
    entryHash = vi.fn();
    dataHashAt = vi.fn();
  }
  return {
    ...actual,
    Contract: MockContract,
  };
});

import {
  listCreatedAssetIds,
  readIssuePreflight,
  readOnChainAssetDetail,
} from "./registry-read";

const TITLE = "0x27fE06348f6937f0f980790EC6963633f2D22F2a";
const ATTEST = "0x29Ac990fBc054afab565c0270Ae324e48D70603a";
const IDENTITY = "0x2525Db5706d4547B93cF2b608c9809bE2a887EE9";
const ASSET =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab";
const HOLDER =
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("readIssuePreflight", () => {
  beforeEach(() => {
    assetState.mockReset();
    isCertified.mockReset();
    isVerified.mockReset();
  });

  it("blocks when asset is Unknown and not certified", async () => {
    assetState.mockResolvedValue(0);
    isCertified.mockResolvedValue(false);
    isVerified.mockResolvedValue(true);
    const pre = await readIssuePreflight(TITLE, ATTEST, IDENTITY, ASSET, HOLDER);
    expect(pre.ok).toBe(false);
    expect(pre.needsCreate).toBe(true);
    expect(pre.reason).toMatch(/CertificationExpired|certific/i);
  });

  it("allows create+issue when Unknown + certified + verified", async () => {
    assetState.mockResolvedValue(0);
    isCertified.mockResolvedValue(true);
    isVerified.mockResolvedValue(true);
    const pre = await readIssuePreflight(TITLE, ATTEST, IDENTITY, ASSET, HOLDER);
    expect(pre).toEqual({
      state: "Unknown",
      needsCreate: true,
      certified: true,
      holderVerified: true,
      ok: true,
    });
  });

  it("blocks Paused assets", async () => {
    assetState.mockResolvedValue(2);
    isCertified.mockResolvedValue(true);
    isVerified.mockResolvedValue(true);
    const pre = await readIssuePreflight(TITLE, ATTEST, IDENTITY, ASSET, HOLDER);
    expect(pre.ok).toBe(false);
    expect(pre.reason).toMatch(/Paused/);
  });
});

describe("listCreatedAssetIds", () => {
  beforeEach(() => {
    getBlockNumber.mockReset();
    getLogs.mockReset();
  });

  it("parses AssetCreated logs", async () => {
    getBlockNumber.mockResolvedValue(1000);
    getLogs.mockResolvedValue([
      {
        topics: [
          "0xb260ea221b18e52b8abd60ea142b1f969a9fc52297d9428578d6f24e04b10e9e",
          ASSET,
        ],
        data: "0x0000000000000000000000000000000000000000000000000000000000000001",
      },
    ]);
    const ids = await listCreatedAssetIds(TITLE, 500);
    expect(ids).toContain(ASSET.toLowerCase());
  });
});

describe("readOnChainAssetDetail", () => {
  beforeEach(() => {
    assetState.mockReset();
    isCertified.mockReset();
    getBlockNumber.mockReset();
    getLogs.mockReset();
  });

  it("returns null for Unknown state", async () => {
    assetState.mockResolvedValue(0);
    const detail = await readOnChainAssetDetail(TITLE, ATTEST, ASSET);
    expect(detail).toBeNull();
  });

  it("loads Active asset with empty ledger and holders", async () => {
    assetState.mockResolvedValue(1);
    isCertified.mockResolvedValue(true);
    getBlockNumber.mockResolvedValue(100);
    getLogs.mockResolvedValue([]);
    const detail = await readOnChainAssetDetail(TITLE, ATTEST, ASSET, 50);
    expect(detail).toMatchObject({
      assetId: ASSET.toLowerCase(),
      state: "Active",
      certified: true,
      totalIssued: "1000",
      circulating: "1000",
      ledgerOk: true,
      entries: [],
      holders: [],
    });
  });
});
