import { afterEach, describe, expect, it } from 'vitest';

import { runLifecycle } from '../src/scenarios/lifecycle.ts';
import type { RelayerFleet } from '../src/sim/relayer-fleet.ts';

let fleet: RelayerFleet | undefined;

afterEach(() => {
  fleet?.close();
  fleet = undefined;
});

describe('E2E lifecycle (C10)', () => {
  it('runs issue → place → approve/reject/expire → court → redeem with clean reconcile', async () => {
    const result = await runLifecycle();
    fleet = result.fleet;
    const { world, report } = result;

    expect(world.ethRequests.get('t-ok')?.status).toBe('Approved');
    expect(world.solEscrows.get('t-ok')?.status).toBe('Completed');

    expect(world.ethRequests.get('t-rej')?.status).toBe('Rejected');
    expect(world.solEscrows.get('t-rej')?.status).toBe('Refunded');

    expect(world.ethRequests.get('t-exp')?.status).toBe('Expired');
    expect(world.solEscrows.get('t-exp')?.status).toBe('Refunded');

    expect(world.ethRequests.get('t-p7')?.status).toBe('CourtCancelled');
    expect(world.solEscrows.get('t-p7')?.status).toBe('CourtCancelled');

    expect(world.ethRedeemed).toBe(2n);
    expect(report.i2Ok).toBe(true);
    expect(report.divergences).toEqual([]);
  });
});
