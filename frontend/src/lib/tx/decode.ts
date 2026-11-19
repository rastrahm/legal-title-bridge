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

const TITLE_FRAGMENT = [
  "function issue(bytes32 assetId, address to, uint256 amount)",
  "function pause()",
  "function forcedTransfer(bytes32 assetId, address from, address to, uint256 amount, bytes32 resolutionHash)",
  "function reconcile(bytes32 transferId, bytes32 resolutionHash)",
  "function decide(bytes32 transferId, uint8 outcome)",
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
 * Encode a lab `issue` call for simulation / confirmation demos.
 */
export function encodeIssueCall(
  assetId: string,
  to: string,
  amount: bigint,
): string {
  return iface.encodeFunctionData("issue", [assetId, to, amount]);
}

/**
 * Encode pause().
 */
export function encodePauseCall(): string {
  return iface.encodeFunctionData("pause", []);
}
