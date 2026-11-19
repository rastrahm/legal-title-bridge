import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useNetworkGuard } from "./useNetworkGuard";
import { LOCAL_NETWORK } from "@/lib/config/network";

describe("useNetworkGuard", () => {
  it("disables signing on wrong eth chain", () => {
    const { result } = renderHook(() =>
      useNetworkGuard({
        ethChainId: 1,
        solGenesisHash: LOCAL_NETWORK.solanaGenesisHash,
        network: LOCAL_NETWORK,
      }),
    );
    expect(result.current.canSignEth).toBe(false);
    expect(result.current.canSignSol).toBe(true);
  });
});
