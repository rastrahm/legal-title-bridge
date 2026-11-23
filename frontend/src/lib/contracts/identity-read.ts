/**
 * Read-only IdentityRegistry views (no wallet signature).
 */

import { Contract } from "ethers";

import { getReadOnlyEthProvider } from "@/lib/eth-rpc";

const IDENTITY_READ_ABI = [
  "function isVerified(bytes32 holder) view returns (bool)",
] as const;

export type VerificationStatus = "verified" | "unverified" | "unknown";

/**
 * Query IdentityRegistry.isVerified(holder). Returns unknown on RPC failure.
 */
export async function readIsVerified(
  identityAddress: string,
  holder: string,
): Promise<VerificationStatus> {
  try {
    const provider = getReadOnlyEthProvider();
    const identity = new Contract(identityAddress, IDENTITY_READ_ABI, provider);
    const ok = (await identity.isVerified(holder)) as boolean;
    return ok ? "verified" : "unverified";
  } catch {
    return "unknown";
  }
}
