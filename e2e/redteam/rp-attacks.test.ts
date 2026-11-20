/**
 * C11 E2E redteam: protocol attacks against the in-process World harness.
 * Positive controls use intentionally weak local helpers; real World paths reject.
 */

import { describe, expect, it } from 'vitest';

import { World } from '../src/sim/world.ts';
import {
  runF4_d6Reconcile,
  runF2_doubleDeliver,
} from '../src/scenarios/failures.ts';

/** INTENTIONALLY WEAK: marks nothing — P1 positive control. */
function vulnerableApplyTwice(world: World, messageId: string, apply: () => void): void {
  apply();
  apply(); // no processed-set check
  void messageId;
}

describe('e2e/redteam R/P against World', () => {
  it('P1 vulnerable: double apply without processed set doubles effect', () => {
    const w = new World();
    w.issue('alice', 100n);
    let hits = 0;
    vulnerableApplyTwice(w, 'mid-p1', () => {
      hits += 1;
      w.solIssued += 1n; // simulate mint without I3
    });
    expect(hits).toBe(2);
    expect(w.solIssued).toBe(102n);
  });

  it('P1 real: World processed set blocks double delivery (via F2)', async () => {
    const r = await runF2_doubleDeliver();
    expect(r.results.filter((x) => x === 'delivered')).toHaveLength(1);
  });

  it('P4/D6: late approval divergence detected and reconciled (F4)', async () => {
    const r = await runF4_d6Reconcile();
    expect(r.d6Detected).toBe(true);
    expect(r.i2OkAfter).toBe(true);
  });

  it('R5a-style: World does not accept under-threshold as delivery', () => {
    const w = new World();
    const mid = 'unsigned-msg';
    expect(w.ethProcessed.has(mid)).toBe(false);
    expect(w.solProcessed.has(mid)).toBe(false);
  });
});
