import { describe, expect, it } from 'vitest';

import { World } from '../src/sim/world.ts';
import { RelayerFleet } from '../src/sim/relayer-fleet.ts';

describe('e2e harness smoke', () => {
  it('wires World + RelayerFleet with real MessageStore', () => {
    const world = new World();
    const fleet = new RelayerFleet({ world, confirmations: 0 });
    world.issue('alice', 1n);
    const msg = world.issueOutbound('alice', 1n);
    expect(fleet.observe(msg, { forceFinal: true })).toBe(true);
    expect(fleet.store.count()).toBe(1);
    fleet.close();
  });
});
