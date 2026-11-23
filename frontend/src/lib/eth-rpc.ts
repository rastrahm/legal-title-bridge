/**
 * Read-only Ethereum JSON-RPC for views (isVerified, etc.).
 * Prefer NEXT_PUBLIC_ETH_RPC_URL; else network defaults (lab).
 */

import { JsonRpcProvider } from "ethers";

import { getActiveNetwork } from "@/lib/config/network";

/** Default public Sepolia endpoint for lab reads (no keys). */
const SEPOLIA_FALLBACK = "https://ethereum-sepolia-rpc.publicnode.com";
const LOCAL_FALLBACK = "http://127.0.0.1:8545";

/**
 * Provider for eth_call without MetaMask.
 */
export function getReadOnlyEthProvider(): JsonRpcProvider {
  const fromEnv = process.env.NEXT_PUBLIC_ETH_RPC_URL?.trim();
  if (fromEnv) {
    return new JsonRpcProvider(fromEnv);
  }
  const net = getActiveNetwork().networkId;
  return new JsonRpcProvider(
    net === "sepolia-devnet" ? SEPOLIA_FALLBACK : LOCAL_FALLBACK,
  );
}
