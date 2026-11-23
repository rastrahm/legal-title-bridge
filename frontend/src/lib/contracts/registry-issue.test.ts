import { beforeEach, describe, expect, it, vi } from "vitest";

const assetState = vi.fn();
const createAsset = vi.fn();
const issue = vi.fn();

vi.mock("@/lib/wallets/provider", () => ({
  getMetaMaskBrowserProvider: vi.fn(() => ({
    getSigner: async () => ({}),
    getNetwork: async () => ({ chainId: 11155111n }),
  })),
}));

vi.mock("ethers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ethers")>();
  class MockContract {
    assetState = assetState;
    createAsset = createAsset;
    issue = issue;
  }
  return {
    ...actual,
    Contract: MockContract,
  };
});

import { createAssetAndIssueOnChain } from "./registry";

const TITLE = "0x27fE06348f6937f0f980790EC6963633f2D22F2a";
const ASSET =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab";
const HOLDER =
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("createAssetAndIssueOnChain", () => {
  beforeEach(() => {
    assetState.mockReset();
    createAsset.mockReset();
    issue.mockReset();
  });

  it("calls createAsset when state is Unknown then issue", async () => {
    assetState.mockResolvedValue(0);
    createAsset.mockResolvedValue({
      hash: "0xcreate",
      wait: async () => ({ hash: "0xcreate" }),
    });
    issue.mockResolvedValue({
      hash: "0xissue",
      wait: async () => ({ hash: "0xissue" }),
    });
    const result = await createAssetAndIssueOnChain(
      TITLE,
      ASSET,
      5000n,
      HOLDER,
    );
    expect(createAsset).toHaveBeenCalledWith(ASSET);
    expect(issue).toHaveBeenCalledWith(ASSET, 5000n, HOLDER);
    expect(result).toEqual({
      createTxHash: "0xcreate",
      issueTxHash: "0xissue",
    });
  });

  it("skips createAsset when already Active", async () => {
    assetState.mockResolvedValue(1);
    issue.mockResolvedValue({
      hash: "0xissue2",
      wait: async () => ({ hash: "0xissue2" }),
    });
    const result = await createAssetAndIssueOnChain(
      TITLE,
      ASSET,
      100n,
      HOLDER,
    );
    expect(createAsset).not.toHaveBeenCalled();
    expect(result.createTxHash).toBeNull();
    expect(result.issueTxHash).toBe("0xissue2");
  });

  it("does not swallow createAsset failure", async () => {
    assetState.mockResolvedValue(0);
    createAsset.mockRejectedValue(
      new Error(
        'execution reverted (action="call", data="0xf558e2dbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab", code=CALL_EXCEPTION)',
      ),
    );
    await expect(
      createAssetAndIssueOnChain(TITLE, ASSET, 1n, HOLDER),
    ).rejects.toThrow(/AssetNotActive/);
    expect(issue).not.toHaveBeenCalled();
  });
});
