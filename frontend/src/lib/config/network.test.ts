import { describe, expect, it } from "vitest";

import {
  getActiveNetwork,
  isEthChainAllowed,
  isSolanaGenesisAllowed,
  LOCAL_NETWORK,
} from "./network";

describe("network guards (W2)", () => {
  it("defaults to local and resolves sepolia-devnet", () => {
    expect(getActiveNetwork().networkId).toBe("local");
    expect(getActiveNetwork("sepolia-devnet").networkId).toBe("sepolia-devnet");
  });

  it("accepts matching eth chain and sol genesis", () => {
    expect(isEthChainAllowed(31337, LOCAL_NETWORK)).toBe(true);
    expect(isEthChainAllowed(1, LOCAL_NETWORK)).toBe(false);
    expect(
      isSolanaGenesisAllowed(LOCAL_NETWORK.solanaGenesisHash, LOCAL_NETWORK),
    ).toBe(true);
    expect(isSolanaGenesisAllowed("other", LOCAL_NETWORK)).toBe(false);
  });
});
