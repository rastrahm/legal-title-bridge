/**
 * Bridge monitor helpers — I2 supply compare and message status labels.
 */

export type MessagePipelineStatus =
  | "seen"
  | "finalized"
  | "signed"
  | "submitted"
  | "delivered"
  | "failed";

export interface SupplyPair {
  ethCirculating: bigint;
  solIssued: bigint;
}

export function checkI2(pair: SupplyPair): boolean {
  return pair.ethCirculating === pair.solIssued;
}

export interface BridgeMessageRow {
  messageId: string;
  status: MessagePipelineStatus;
  direction: "eth_to_sol" | "sol_to_eth";
}
