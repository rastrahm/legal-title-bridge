/**
 * Decode a prepared Ethereum transaction for the confirmation panel (W4).
 * The UI must display decoded calldata — never raw form fields alone.
 */

import { Interface, getAddress, type TransactionRequest } from "ethers";

export interface DecodedTxView {
  to: string;
  value: string;
  functionName: string;
  args: Record<string, string>;
}

/** Matches TitleRegistry on-chain ABI (issue uses bytes32 holder, not address). */
const TITLE_FRAGMENT = [
  "function createAsset(bytes32 assetId)",
  "function issue(bytes32 assetId, uint256 amount, bytes32 toHolder)",
  "function pause()",
  "function forcedTransfer(bytes32 assetId, bytes32 from, bytes32 to, uint256 amount, bytes32 resolutionHash, bytes32 pendingTransferId)",
  "function reconcile(bytes32 transferId, bytes32 resolutionHash)",
  "function decide(bytes32 transferId)",
];

const iface = new Interface(TITLE_FRAGMENT);

/**
 * Build a human-readable view from a TransactionRequest (post-encoding).
 */
export function decodeTransactionRequest(
  tx: TransactionRequest,
): DecodedTxView {
  const to = tx.to ? getAddress(String(tx.to)) : "0x";
  const value = tx.value != null ? BigInt(tx.value).toString() : "0";
  const data = typeof tx.data === "string" ? tx.data : "0x";

  if (!data || data === "0x") {
    return { to, value, functionName: "nativeTransfer", args: {} };
  }

  try {
    const parsed = iface.parseTransaction({ data });
    if (!parsed) {
      return { to, value, functionName: "unknown", args: { data } };
    }
    const args: Record<string, string> = {};
    parsed.fragment.inputs.forEach((input, idx) => {
      const v = parsed.args[idx];
      args[input.name] = typeof v === "bigint" ? v.toString() : String(v);
    });
    return { to, value, functionName: parsed.name, args };
  } catch {
    return { to, value, functionName: "unknown", args: { data } };
  }
}

/**
 * Encode TitleRegistry.issue(assetId, amount, toHolder).
 */
export function encodeIssueCall(
  assetId: string,
  amount: bigint,
  toHolder: string,
): string {
  return iface.encodeFunctionData("issue", [assetId, amount, toHolder]);
}

/**
 * Encode TitleRegistry.createAsset(assetId).
 */
export function encodeCreateAssetCall(assetId: string): string {
  return iface.encodeFunctionData("createAsset", [assetId]);
}

/**
 * Encode pause().
 */
export function encodePauseCall(): string {
  return iface.encodeFunctionData("pause", []);
}

/**
 * Encode TitleRegistry.decide(transferId) — OPERATOR_ROLE.
 */
export function encodeDecideCall(transferId: string): string {
  return iface.encodeFunctionData("decide", [transferId]);
}
