import { describe, expect, it } from 'vitest';

import { buildReconcileReport, checkI2, reconcileRequests } from '../src/reconciler.ts';

describe('reconciler I2 + D6', () => {
  it('checkI2 compares circulating vs issued', () => {
    expect(checkI2({ ethCirculating: 100n, solIssued: 100n })).toBe(true);
    expect(checkI2({ ethCirculating: 100n, solIssued: 99n })).toBe(false);
  });

  it('flags D6 when Eth Approved and Sol Refunded', () => {
    const d = reconcileRequests([
      { transferId: 't1', ethStatus: 'Approved', solStatus: 'Refunded' },
      { transferId: 't2', ethStatus: 'Approved', solStatus: 'Completed' },
    ]);
    expect(d).toHaveLength(1);
    expect(d[0]?.reason).toBe('D6_late_approval');
    expect(d[0]?.transferId).toBe('t1');
  });

  it('buildReconcileReport aggregates I2 and divergences', () => {
    const report = buildReconcileReport(
      { ethCirculating: 50n, solIssued: 50n },
      [{ transferId: 't', ethStatus: 'Rejected', solStatus: 'Completed' }]
    );
    expect(report.i2Ok).toBe(true);
    expect(report.divergences[0]?.reason).toBe('status_mismatch');
  });
});
