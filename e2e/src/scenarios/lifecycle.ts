/**
 * Full DvP lifecycle on the in-process World + RelayerFleet.
 */

import { RelayerFleet } from '../sim/relayer-fleet.ts';
import { World } from '../sim/world.ts';

export interface LifecycleResult {
  world: World;
  fleet: RelayerFleet;
  report: ReturnType<RelayerFleet['reconcile']>;
}

async function finalizeAndDeliver(fleet: RelayerFleet, world: World, ev: ReturnType<World['decide']>): Promise<void> {
  // Not yet confirmed
  fleet.observe(ev);
  // Advance head past confirmations
  world.ethBlock = ev.emittedAt + fleet.confirmations;
  fleet.advanceEthHead(world.ethBlock);
  fleet.observe(ev);
  await fleet.pump();
}

export async function runLifecycle(): Promise<LifecycleResult> {
  const world = new World();
  const fleet = new RelayerFleet({ world, confirmations: 2 });

  const seller = 'seller';
  const buyer = 'buyer';
  const courtDest = 'court-dest';

  // 1) Issue / placement
  world.issue(seller, 100n);
  const issueMsg = world.issueOutbound(seller, 100n);
  world.ethBlock = issueMsg.emittedAt + 2;
  fleet.advanceEthHead(world.ethBlock);
  fleet.observe(issueMsg);
  await fleet.pump();

  // 2) Approved transfer
  world.registerRequest({
    transferId: 't-ok',
    seller,
    buyer,
    amount: 10n,
    deadline: world.now + 3600,
  });
  const approved = world.decide('t-ok', 'Approved');
  await finalizeAndDeliver(fleet, world, approved);

  // 3) Rejected transfer
  world.registerRequest({
    transferId: 't-rej',
    seller,
    buyer,
    amount: 5n,
    deadline: world.now + 3600,
  });
  const rejected = world.decide('t-rej', 'Rejected');
  await finalizeAndDeliver(fleet, world, rejected);

  // 4) Expired transfer
  world.registerRequest({
    transferId: 't-exp',
    seller,
    buyer,
    amount: 5n,
    deadline: world.now + 10,
  });
  world.now += 11;
  const expired = world.decide('t-exp', 'Expired');
  await finalizeAndDeliver(fleet, world, expired);

  // 5) Court order (no escrow)
  const forced = world.forcedTransfer(seller, courtDest, 3n);
  await finalizeAndDeliver(fleet, world, forced);

  // 6) Court on pending escrow (P7)
  world.registerRequest({
    transferId: 't-p7',
    seller,
    buyer,
    amount: 4n,
    deadline: world.now + 3600,
  });
  const forcedP7 = world.forcedTransfer(seller, courtDest, 4n, 't-p7');
  await finalizeAndDeliver(fleet, world, forcedP7);

  // 7) Redeem in kind
  const redeem = world.redeemInKind(seller, 2n);
  await finalizeAndDeliver(fleet, world, redeem);

  const report = fleet.reconcile();
  // Caller owns fleet.close(); leave open for assertions.
  return { world, fleet, report };
}
