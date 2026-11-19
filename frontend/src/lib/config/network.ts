/**
 * Expected chain identifiers for Legal Title Bridge networks (W2).
 * Addresses always come from `@legal-title-bridge/shared` — never from the URL (D14).
 */

import type { NetworkId } from "@/vendor/shared";

export interface NetworkExpectations {
  networkId: NetworkId;
  ethChainId: number;
  /** Solana genesis hash (base58) expected for the cluster. */
  solanaGenesisHash: string;
  labelEs: string;
  labelEn: string;
}

/** Local anvil + solana-test-validator expectations. */
export const LOCAL_NETWORK: NetworkExpectations = {
  networkId: "local",
  ethChainId: 31337,
  // Placeholder genesis for lab validator; replaced when stack publishes real hash.
  solanaGenesisHash: "11111111111111111111111111111111",
  labelEs: "Local (anvil + validator)",
  labelEn: "Local (anvil + validator)",
};

/** Sepolia + Solana Devnet expectations. */
export const SEPOLIA_DEVNET_NETWORK: NetworkExpectations = {
  networkId: "sepolia-devnet",
  ethChainId: 11155111,
  solanaGenesisHash: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrvAE",
  labelEs: "Sepolia + Solana Devnet",
  labelEn: "Sepolia + Solana Devnet",
};

const BY_ID: Record<NetworkId, NetworkExpectations> = {
  local: LOCAL_NETWORK,
  "sepolia-devnet": SEPOLIA_DEVNET_NETWORK,
};

/**
 * Resolves network expectations from env / default. Never reads contract addresses from URL.
 */
export function getActiveNetwork(
  override?: NetworkId | string | null,
): NetworkExpectations {
  const raw =
    override ??
    process.env.NEXT_PUBLIC_NETWORK_ID ??
    "local";
  if (raw === "sepolia-devnet") return BY_ID["sepolia-devnet"];
  return BY_ID.local;
}

/**
 * Returns true when the wallet ethereum chainId matches the active network.
 */
export function isEthChainAllowed(
  chainId: number | null | undefined,
  expected: NetworkExpectations = getActiveNetwork(),
): boolean {
  return chainId === expected.ethChainId;
}

/**
 * Returns true when the Solana cluster genesis matches the active network.
 */
export function isSolanaGenesisAllowed(
  genesisHash: string | null | undefined,
  expected: NetworkExpectations = getActiveNetwork(),
): boolean {
  return genesisHash === expected.solanaGenesisHash;
}
