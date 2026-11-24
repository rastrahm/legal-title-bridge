/**
 * Ledger chain verification in the browser (explorer integrity / X14).
 *
 * - Demo / lab strings: entryHash = keccak256(prevHash ‖ utf8(data))
 * - On-chain TitleRegistry: entryHash = keccak256(prevHash ‖ dataHash) with dataHash as bytes32
 *   (LedgerChain.sol). `data` then holds the 0x-prefixed 32-byte hex from `dataHashAt`.
 */

import { concat, keccak256, toUtf8Bytes } from "ethers";

export interface LedgerEntry {
  /** Hex hash of this entry (0x…). */
  entryHash: string;
  /** Previous entry hash (0x…); genesis may be zero hash. */
  prevHash: string;
  /**
   * Demo: human-readable payload string.
   * On-chain: bytes32 dataHash hex from the registry.
   */
  data: string;
}

export interface LedgerVerification {
  ok: boolean;
  /** Index of the first broken entry, or -1 if intact. */
  breakAt: number;
  recomputed: string[];
}

const ZERO =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

const BYTES32_HEX = /^0x[0-9a-fA-F]{64}$/;

/**
 * Compute next entry hash. Bytes32 hex `data` follows Solidity LedgerChain.nextHash.
 */
export function computeEntryHash(prevHash: string, data: string): string {
  const prev = prevHash.toLowerCase() === ZERO ? ZERO : prevHash;
  if (BYTES32_HEX.test(data)) {
    return keccak256(concat([prev as `0x${string}`, data as `0x${string}`]));
  }
  return keccak256(concat([prev as `0x${string}`, toUtf8Bytes(data)]));
}

/**
 * Walk the ledger and report where the chain breaks (if anywhere).
 */
export function verifyLedgerChain(entries: LedgerEntry[]): LedgerVerification {
  const recomputed: string[] = [];
  let expectedPrev = ZERO;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) {
      return { ok: false, breakAt: i, recomputed };
    }
    if (entry.prevHash.toLowerCase() !== expectedPrev.toLowerCase()) {
      return { ok: false, breakAt: i, recomputed };
    }
    const hash = computeEntryHash(entry.prevHash, entry.data);
    recomputed.push(hash);
    if (hash.toLowerCase() !== entry.entryHash.toLowerCase()) {
      return { ok: false, breakAt: i, recomputed };
    }
    expectedPrev = entry.entryHash;
  }

  return { ok: true, breakAt: -1, recomputed };
}
