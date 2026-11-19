import { describe, expect, it } from 'vitest';

import {
  runF1_killAndRestartRelayer,
  runF2_doubleDeliver,
  runF3_outOfOrder,
  runF4_d6Reconcile,
  runF5_reorgBeforeConfirm,
} from '../src/scenarios/failures.ts';

describe('E2E induced failures F1–F5', () => {
  it('F1: kill/restart relayer — message delivered once (I3)', async () => {
    const r = await runF1_killAndRestartRelayer();
    expect(r.deliveredOnce).toBe(true);
    expect(r.storeCount).toBe(1);
  });

  it('F2: concurrent double deliver — one wins, no double effect', async () => {
    const r = await runF2_doubleDeliver();
    expect(r.results.filter((x) => x === 'delivered')).toHaveLength(1);
    expect(r.results.every((x) => x === 'delivered' || x === 'skipped' || x === 'retry')).toBe(true);
    expect(r.solStatus).toBe('Completed');
  });

  it('F3: out-of-order decision fails then succeeds after prerequisite', async () => {
    const r = await runF3_outOfOrder();
    expect(r.prematureFailed).toBe(true);
    expect(r.laterOk).toBe(true);
  });

  it('F4: D6 late approval detected then Eth reconcile restores agreement', async () => {
    const r = await runF4_d6Reconcile();
    expect(r.d6Detected).toBe(true);
    expect(r.ethStatus).toBe('Reconciled');
    expect(r.solStatus).toBe('Refunded');
    expect(r.i2OkAfter).toBe(true);
  });

  it('F5: reorg before confirmations — nothing applied on Solana', async () => {
    const r = await runF5_reorgBeforeConfirm();
    expect(r.neverDelivered).toBe(true);
    expect(r.solUnchanged).toBe(true);
  });
});
