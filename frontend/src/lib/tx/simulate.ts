/**
 * Pre-sign simulation helpers (eth_call style). Lab uses an injectable caller.
 */

import type { TransactionRequest } from "ethers";

export interface EthCallProvider {
  call(tx: TransactionRequest): Promise<string>;
}

export type SimulationResult =
  | { ok: true; returnData: string }
  | { ok: false; error: string };

/**
 * Simulate a transaction via eth_call without broadcasting.
 */
export async function simulateTransaction(
  provider: EthCallProvider,
  tx: TransactionRequest,
): Promise<SimulationResult> {
  try {
    const returnData = await provider.call(tx);
    return { ok: true, returnData };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, error };
  }
}
