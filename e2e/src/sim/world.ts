/**
 * In-process dual-chain world for E2E scenarios (Eth ledger + Solana mirror/escrow).
 * Not a substitute for live validators; exercises protocol state machines + relayer store.
 */

export type EthRequestStatus =
  | 'None'
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Expired'
  | 'Reconciled'
  | 'CourtCancelled';

export type SolEscrowStatus = 'None' | 'Pending' | 'Completed' | 'Refunded' | 'CourtCancelled';

export interface EthRequest {
  transferId: string;
  seller: string;
  buyer: string;
  amount: bigint;
  deadline: number;
  status: EthRequestStatus;
}

export interface SolEscrow {
  transferId: string;
  seller: string;
  buyer: string;
  amount: bigint;
  paymentAmount: bigint;
  deadline: number;
  hardDeadline: number;
  status: SolEscrowStatus;
}

export interface BridgeMessage {
  messageId: string;
  direction: 'eth_to_sol' | 'sol_to_eth';
  msgType: number;
  wire: Uint8Array;
  /** Simulated source-chain block / slot at emission. */
  emittedAt: number;
}

export class World {
  ethBalances = new Map<string, bigint>();
  ethIssued = 0n;
  ethRedeemed = 0n;
  ethRequests = new Map<string, EthRequest>();

  solIssued = 0n;
  solBalances = new Map<string, bigint>();
  solEscrows = new Map<string, SolEscrow>();
  /** messageIds already applied on each destination (I3). */
  ethProcessed = new Set<string>();
  solProcessed = new Set<string>();

  ethBlock = 1;
  solSlot = 1;
  now = 1_700_000_000;

  circulating(): bigint {
    return this.ethIssued - this.ethRedeemed;
  }

  issue(to: string, amount: bigint): void {
    this.ethIssued += amount;
    this.ethBalances.set(to, (this.ethBalances.get(to) ?? 0n) + amount);
    this.solIssued += amount;
    this.solBalances.set(to, (this.solBalances.get(to) ?? 0n) + amount);
  }

  registerRequest(req: Omit<EthRequest, 'status'> & { hardDeadlineSecs?: number }): void {
    const { hardDeadlineSecs, ...ethFields } = req;
    this.ethRequests.set(req.transferId, { ...ethFields, status: 'Pending' });
    const hard = req.deadline + (hardDeadlineSecs ?? 7 * 24 * 3600);
    this.solEscrows.set(req.transferId, {
      transferId: req.transferId,
      seller: req.seller,
      buyer: req.buyer,
      amount: req.amount,
      paymentAmount: req.amount, // 1:1 stub payment units
      deadline: req.deadline,
      hardDeadline: hard,
      status: 'Pending',
    });
    // Lock sol title into escrow
    const bal = this.solBalances.get(req.seller) ?? 0n;
    if (bal < req.amount) throw new Error('insufficient sol balance');
    this.solBalances.set(req.seller, bal - req.amount);
  }

  decide(transferId: string, outcome: 'Approved' | 'Rejected' | 'Expired'): BridgeMessage {
    const req = this.ethRequests.get(transferId);
    if (!req || req.status !== 'Pending') throw new Error('not pending');
    if (outcome === 'Expired' || this.now > req.deadline) {
      req.status = 'Expired';
    } else if (outcome === 'Rejected') {
      req.status = 'Rejected';
    } else {
      req.status = 'Approved';
      const from = this.ethBalances.get(req.seller) ?? 0n;
      if (from < req.amount) throw new Error('insufficient eth balance');
      this.ethBalances.set(req.seller, from - req.amount);
      this.ethBalances.set(req.buyer, (this.ethBalances.get(req.buyer) ?? 0n) + req.amount);
    }
    this.ethBlock += 1;
    const messageId = `decision:${transferId}:${req.status}`;
    return {
      messageId,
      direction: 'eth_to_sol',
      msgType: 2,
      wire: new TextEncoder().encode(messageId),
      emittedAt: this.ethBlock,
    };
  }

  applyDecisionOnSol(transferId: string, messageId: string): void {
    if (this.solProcessed.has(messageId)) throw new Error('MessageAlreadyProcessed');
    const esc = this.solEscrows.get(transferId);
    if (!esc || esc.status !== 'Pending') throw new Error('escrow not pending');
    const req = this.ethRequests.get(transferId);
    if (!req) throw new Error('missing eth request');

    if (req.status === 'Approved') {
      if (this.now >= esc.hardDeadline) throw new Error('LateApprovalRejected');
      this.solBalances.set(esc.buyer, (this.solBalances.get(esc.buyer) ?? 0n) + esc.amount);
      esc.status = 'Completed';
    } else {
      this.solBalances.set(esc.seller, (this.solBalances.get(esc.seller) ?? 0n) + esc.amount);
      esc.status = 'Refunded';
    }
    this.solProcessed.add(messageId);
    this.solSlot += 1;
  }

  refundAfterHardDeadline(transferId: string): void {
    const esc = this.solEscrows.get(transferId);
    if (!esc || esc.status !== 'Pending') throw new Error('escrow not pending');
    if (this.now < esc.hardDeadline) throw new Error('TooEarlyForRefund');
    this.solBalances.set(esc.seller, (this.solBalances.get(esc.seller) ?? 0n) + esc.amount);
    esc.status = 'Refunded';
  }

  reconcileEth(transferId: string): void {
    const req = this.ethRequests.get(transferId);
    if (!req || req.status !== 'Approved') throw new Error('not approved');
    const buyerBal = this.ethBalances.get(req.buyer) ?? 0n;
    if (buyerBal < req.amount) throw new Error('insufficient');
    this.ethBalances.set(req.buyer, buyerBal - req.amount);
    this.ethBalances.set(req.seller, (this.ethBalances.get(req.seller) ?? 0n) + req.amount);
    req.status = 'Reconciled';
  }

  forcedTransfer(from: string, to: string, amount: bigint, transferId?: string): BridgeMessage {
    const fromBal = this.ethBalances.get(from) ?? 0n;
    if (fromBal < amount) throw new Error('insufficient');
    this.ethBalances.set(from, fromBal - amount);
    this.ethBalances.set(to, (this.ethBalances.get(to) ?? 0n) + amount);
    if (transferId) {
      const req = this.ethRequests.get(transferId);
      if (req?.status === 'Pending') req.status = 'CourtCancelled';
      const esc = this.solEscrows.get(transferId);
      if (esc?.status === 'Pending') {
        this.solBalances.set(to, (this.solBalances.get(to) ?? 0n) + esc.amount);
        esc.status = 'CourtCancelled';
      }
    }
    this.ethBlock += 1;
    const messageId = `forced:${from}:${to}:${amount.toString()}`;
    return {
      messageId,
      direction: 'eth_to_sol',
      msgType: 3,
      wire: new TextEncoder().encode(messageId),
      emittedAt: this.ethBlock,
    };
  }

  applyForcedOnSol(messageId: string, from: string, to: string, amount: bigint): void {
    if (this.solProcessed.has(messageId)) throw new Error('MessageAlreadyProcessed');
    // If already moved via P7 escrow path, skip balance move
    if (!this.solBalances.has(to) || (this.solBalances.get(from) ?? 0n) >= amount) {
      const fromBal = this.solBalances.get(from) ?? 0n;
      if (fromBal >= amount) {
        this.solBalances.set(from, fromBal - amount);
        this.solBalances.set(to, (this.solBalances.get(to) ?? 0n) + amount);
      }
    }
    this.solProcessed.add(messageId);
  }

  redeemInKind(holder: string, amount: bigint): BridgeMessage {
    const bal = this.ethBalances.get(holder) ?? 0n;
    if (bal < amount) throw new Error('insufficient');
    this.ethBalances.set(holder, bal - amount);
    this.ethRedeemed += amount;
    const sBal = this.solBalances.get(holder) ?? 0n;
    if (sBal < amount) throw new Error('insufficient sol');
    this.solBalances.set(holder, sBal - amount);
    this.solIssued -= amount;
    this.ethBlock += 1;
    const messageId = `redeem:${holder}:${amount.toString()}`;
    return {
      messageId,
      direction: 'eth_to_sol',
      msgType: 3,
      wire: new TextEncoder().encode(messageId),
      emittedAt: this.ethBlock,
    };
  }

  applyRedeemOnSol(messageId: string): void {
    if (this.solProcessed.has(messageId)) throw new Error('MessageAlreadyProcessed');
    this.solProcessed.add(messageId);
  }

  issueOutbound(to: string, amount: bigint): BridgeMessage {
    // Eth issue already applied in issue(); outbound mirrors to sol (already mirrored in sim issue).
    this.ethBlock += 1;
    const messageId = `issue:${to}:${amount.toString()}:${this.ethBlock}`;
    return {
      messageId,
      direction: 'eth_to_sol',
      msgType: 0,
      wire: new TextEncoder().encode(messageId),
      emittedAt: this.ethBlock,
    };
  }

  applyIssueOnSol(messageId: string): void {
    if (this.solProcessed.has(messageId)) throw new Error('MessageAlreadyProcessed');
    this.solProcessed.add(messageId);
  }
}
