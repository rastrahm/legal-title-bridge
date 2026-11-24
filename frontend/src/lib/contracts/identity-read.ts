/**
 * Read-only IdentityRegistry views (no wallet signature).
 */

import { Contract } from "ethers";

import { getReadOnlyEthProvider } from "@/lib/eth-rpc";

const IDENTITY_READ_ABI = [
  "function isVerified(bytes32 holder) view returns (bool)",
  "function getAssertion(bytes32 holder) view returns (tuple(bytes32 holder, uint16 country, uint8 investorType, uint64 expiry))",
] as const;

export type VerificationStatus = "verified" | "unverified" | "unknown";

export interface VerificationDetail {
  status: VerificationStatus;
  /** True when an assertion row exists (may still be expired/revoked). */
  hasAssertion: boolean;
  expiry: number | null;
}

const ZERO =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Query IdentityRegistry.isVerified(holder). Returns unknown on RPC failure.
 */
export async function readIsVerified(
  identityAddress: string,
  holder: string,
): Promise<VerificationStatus> {
  const detail = await readVerificationDetail(identityAddress, holder);
  return detail.status;
}

/**
 * isVerified + getAssertion for UI diagnostics (wrong holder vs missing KYC).
 */
export async function readVerificationDetail(
  identityAddress: string,
  holder: string,
): Promise<VerificationDetail> {
  try {
    const provider = getReadOnlyEthProvider();
    const identity = new Contract(identityAddress, IDENTITY_READ_ABI, provider);
    const normalized = holder.toLowerCase();
    const [ok, assertion] = await Promise.all([
      identity.isVerified(normalized) as Promise<boolean>,
      identity.getAssertion(normalized) as Promise<{
        holder: string;
        expiry: bigint;
      }>,
    ]);
    const stored = (assertion.holder ?? ZERO).toLowerCase();
    const hasAssertion = stored !== ZERO;
    const expiry = hasAssertion ? Number(assertion.expiry) : null;
    return {
      status: ok ? "verified" : "unverified",
      hasAssertion,
      expiry,
    };
  } catch {
    return { status: "unknown", hasAssertion: false, expiry: null };
  }
}
