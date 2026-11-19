"use client";

import { useMemo } from "react";

import {
  getActiveNetwork,
  isEthChainAllowed,
  isSolanaGenesisAllowed,
  type NetworkExpectations,
} from "@/lib/config/network";

export interface NetworkGuardInput {
  ethChainId?: number | null;
  solGenesisHash?: string | null;
  network?: NetworkExpectations;
}

/**
 * W2: actions that send txs must be disabled when wallet network mismatches.
 */
export function useNetworkGuard(input: NetworkGuardInput): {
  expected: NetworkExpectations;
  ethOk: boolean;
  solOk: boolean;
  canSignEth: boolean;
  canSignSol: boolean;
} {
  const expected = input.network ?? getActiveNetwork();
  return useMemo(() => {
    const ethOk = isEthChainAllowed(input.ethChainId, expected);
    const solOk = isSolanaGenesisAllowed(input.solGenesisHash, expected);
    return {
      expected,
      ethOk,
      solOk,
      canSignEth: ethOk && input.ethChainId != null,
      canSignSol: solOk && Boolean(input.solGenesisHash),
    };
  }, [expected, input.ethChainId, input.solGenesisHash]);
}
