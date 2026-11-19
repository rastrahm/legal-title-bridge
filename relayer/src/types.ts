/** Shared relayer domain types (English comments). */

export type MessageDirection = 'eth_to_sol' | 'sol_to_eth';

export type MessageStatus =
  | 'seen'
  | 'finalized'
  | 'signed'
  | 'quorum_ready'
  | 'submitted'
  | 'delivered'
  | 'failed';

export interface StoredMessage {
  messageId: string;
  direction: MessageDirection;
  msgType: number;
  wire: Uint8Array;
  status: MessageStatus;
  attempts: number;
  nextRetryAt: number | null;
  lastError: string | null;
  /** Hex-encoded 65-byte signatures collected for quorum. */
  signatures: string[];
  createdAt: number;
  updatedAt: number;
}

export interface InsertMessageInput {
  messageId: string;
  direction: MessageDirection;
  msgType: number;
  wire: Uint8Array;
  status?: MessageStatus;
}

export interface SupplySnapshot {
  ethCirculating: bigint;
  solIssued: bigint;
}

export type RequestStatusLabel =
  | 'None'
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Expired'
  | 'Reconciled'
  | 'CourtCancelled'
  | 'Completed'
  | 'Refunded'
  | 'CourtCancelledSol'
  | 'Unknown';

export interface RequestPair {
  transferId: string;
  ethStatus: RequestStatusLabel;
  solStatus: RequestStatusLabel;
}

export interface ReconcileReport {
  i2Ok: boolean;
  ethCirculating: bigint;
  solIssued: bigint;
  divergences: Array<{
    transferId: string;
    reason: 'D6_late_approval' | 'status_mismatch';
    ethStatus: RequestStatusLabel;
    solStatus: RequestStatusLabel;
  }>;
}
