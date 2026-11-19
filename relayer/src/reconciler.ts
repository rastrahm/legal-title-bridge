/**
 * Cross-chain reconciler — I2 supply check + request status / D6 detection.
 */

import type { ReconcileReport, RequestPair, SupplySnapshot } from './types.ts';

/**
 * I2: Ethereum circulating supply must equal Solana issued units for the bridged asset.
 */
export function checkI2(snap: SupplySnapshot): boolean {
  return snap.ethCirculating === snap.solIssued;
}

/**
 * Detect divergences. D6: Eth Approved while Solana Refunded after hardDeadline race.
 */
export function reconcileRequests(pairs: RequestPair[]): ReconcileReport['divergences'] {
  const out: ReconcileReport['divergences'] = [];
  for (const p of pairs) {
    if (p.ethStatus === 'Approved' && (p.solStatus === 'Refunded' || p.solStatus === 'CourtCancelledSol')) {
      out.push({
        transferId: p.transferId,
        reason: 'D6_late_approval',
        ethStatus: p.ethStatus,
        solStatus: p.solStatus,
      });
      continue;
    }
    const ethTerminal = isEthTerminal(p.ethStatus);
    const solTerminal = isSolTerminal(p.solStatus);
    if (ethTerminal && solTerminal && !statusesAgree(p.ethStatus, p.solStatus)) {
      out.push({
        transferId: p.transferId,
        reason: 'status_mismatch',
        ethStatus: p.ethStatus,
        solStatus: p.solStatus,
      });
    }
  }
  return out;
}

export function buildReconcileReport(snap: SupplySnapshot, pairs: RequestPair[]): ReconcileReport {
  return {
    i2Ok: checkI2(snap),
    ethCirculating: snap.ethCirculating,
    solIssued: snap.solIssued,
    divergences: reconcileRequests(pairs),
  };
}

function isEthTerminal(s: RequestPair['ethStatus']): boolean {
  return s === 'Approved' || s === 'Rejected' || s === 'Expired' || s === 'Reconciled' || s === 'CourtCancelled';
}

function isSolTerminal(s: RequestPair['solStatus']): boolean {
  return s === 'Completed' || s === 'Refunded' || s === 'CourtCancelledSol';
}

function statusesAgree(eth: RequestPair['ethStatus'], sol: RequestPair['solStatus']): boolean {
  if (eth === 'Approved' && sol === 'Completed') return true;
  if ((eth === 'Rejected' || eth === 'Expired' || eth === 'CourtCancelled') && sol === 'Refunded') return true;
  if (eth === 'CourtCancelled' && sol === 'CourtCancelledSol') return true;
  if (eth === 'Reconciled' && sol === 'Refunded') return true; // D6 repaired on Eth
  return false;
}
