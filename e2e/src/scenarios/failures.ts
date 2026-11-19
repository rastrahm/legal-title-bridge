/**
 * Induced failures F1–F5 against World + RelayerFleet.
 */

import { RelayerFleet } from '../sim/relayer-fleet.ts';
import { World } from '../sim/world.ts';

export async function runF1_killAndRestartRelayer(): Promise<{
  deliveredOnce: boolean;
  storeCount: number;
}> {
  const world = new World();
  const fleet = new RelayerFleet({ world, confirmations: 1 });
  world.issue('seller', 50n);
  world.registerRequest({
    transferId: 'f1',
    seller: 'seller',
    buyer: 'buyer',
    amount: 5n,
    deadline: world.now + 1000,
  });
  const msg = world.decide('f1', 'Approved');
  world.ethBlock = msg.emittedAt + 1;
  fleet.advanceEthHead(world.ethBlock);
  fleet.observe(msg);

  // Kill relayer 0 mid-flight after one signature
  fleet.online[0] = false;
  fleet.submitters[1]!.signLocal(msg.messageId);
  fleet.online[0] = true; // restart
  await fleet.pump();

  const stored = fleet.store.get(msg.messageId);
  return {
    deliveredOnce: stored?.status === 'delivered' && world.solEscrows.get('f1')?.status === 'Completed',
    storeCount: fleet.store.count(),
  };
}

export async function runF2_doubleDeliver(): Promise<{
  results: Array<'delivered' | 'skipped' | 'retry'>;
  solStatus: string;
}> {
  const world = new World();
  const fleet = new RelayerFleet({ world, confirmations: 1 });
  world.issue('seller', 50n);
  world.registerRequest({
    transferId: 'f2',
    seller: 'seller',
    buyer: 'buyer',
    amount: 5n,
    deadline: world.now + 1000,
  });
  const msg = world.decide('f2', 'Approved');
  world.ethBlock = msg.emittedAt + 1;
  fleet.advanceEthHead(world.ethBlock);
  fleet.observe(msg);
  // Quorum without delivering
  fleet.submitters[0]!.signLocal(msg.messageId);
  fleet.submitters[1]!.signLocal(msg.messageId);
  const results = await fleet.raceDeliver(msg.messageId);
  return {
    results,
    solStatus: world.solEscrows.get('f2')?.status ?? 'None',
  };
}

export async function runF3_outOfOrder(): Promise<{
  prematureFailed: boolean;
  laterOk: boolean;
}> {
  const world = new World();
  const fleet = new RelayerFleet({ world, confirmations: 0 });
  // Decision message crafted before issue applied on sol — simulate missing prerequisite
  world.issue('seller', 20n); // eth+sol balances exist
  world.registerRequest({
    transferId: 'f3',
    seller: 'seller',
    buyer: 'buyer',
    amount: 2n,
    deadline: world.now + 1000,
  });
  const decision = world.decide('f3', 'Approved');

  // Inject a fake "issue" dependency: first delivery of decision requires issue processed flag
  const issueId = 'issue:prereq:f3';
  let prematureFailed = false;
  const orig = world.applyDecisionOnSol.bind(world);
  world.applyDecisionOnSol = (tid, mid) => {
    if (!world.solProcessed.has(issueId)) {
      prematureFailed = true;
      throw new Error('prerequisite missing');
    }
    orig(tid, mid);
  };

  world.ethBlock = decision.emittedAt;
  fleet.advanceEthHead(world.ethBlock);
  fleet.observe(decision, { forceFinal: true });
  fleet.submitters[0]!.signLocal(decision.messageId);
  fleet.submitters[1]!.signLocal(decision.messageId);
  const first = await fleet.submitters[0]!.tryDeliver(decision.messageId);
  // Mark issue then retry
  world.solProcessed.add(issueId);
  fleet.store.updateStatus(decision.messageId, 'quorum_ready');
  const second = await fleet.submitters[0]!.tryDeliver(decision.messageId);
  return {
    prematureFailed: prematureFailed && first === 'retry',
    laterOk: second === 'delivered' && world.solEscrows.get('f3')?.status === 'Completed',
  };
}

export async function runF4_d6Reconcile(): Promise<{
  d6Detected: boolean;
  i2OkAfter: boolean;
  ethStatus: string;
  solStatus: string;
}> {
  const world = new World();
  const fleet = new RelayerFleet({ world, confirmations: 1 });
  world.issue('seller', 30n);
  world.registerRequest({
    transferId: 'f4',
    seller: 'seller',
    buyer: 'buyer',
    amount: 6n,
    deadline: world.now + 100,
    hardDeadlineSecs: 10,
  });
  // Eth approves on time
  const approved = world.decide('f4', 'Approved');
  // Relayers offline past hardDeadline
  world.now = world.solEscrows.get('f4')!.hardDeadline + 1;
  world.refundAfterHardDeadline('f4');

  // Late delivery attempt fails
  world.ethBlock = approved.emittedAt + 1;
  fleet.advanceEthHead(world.ethBlock);
  fleet.observe(approved);
  fleet.submitters[0]!.signLocal(approved.messageId);
  fleet.submitters[1]!.signLocal(approved.messageId);
  const late = await fleet.submitters[0]!.tryDeliver(approved.messageId);
  void late;

  let report = fleet.reconcile();
  const d6Detected = report.divergences.some((d) => d.reason === 'D6_late_approval');
  // Operator reconciles Eth
  world.reconcileEth('f4');
  report = fleet.reconcile();
  return {
    d6Detected,
    i2OkAfter: report.i2Ok,
    ethStatus: world.ethRequests.get('f4')!.status,
    solStatus: world.solEscrows.get('f4')!.status,
  };
}

export async function runF5_reorgBeforeConfirm(): Promise<{
  neverDelivered: boolean;
  solUnchanged: boolean;
}> {
  const world = new World();
  const fleet = new RelayerFleet({ world, confirmations: 5 });
  world.issue('seller', 40n);
  world.registerRequest({
    transferId: 'f5',
    seller: 'seller',
    buyer: 'buyer',
    amount: 3n,
    deadline: world.now + 1000,
  });
  const snapshotBlock = world.ethBlock;
  const msg = world.decide('f5', 'Approved');
  // Head only +1 — not enough confirmations
  world.ethBlock = msg.emittedAt + 1;
  fleet.advanceEthHead(world.ethBlock);
  const inserted = fleet.observe(msg);
  await fleet.pump();

  // Reorg: revert eth decision (snapshot)
  world.ethBlock = snapshotBlock;
  world.ethRequests.get('f5')!.status = 'Pending';
  // Undo eth balances from approve
  world.ethBalances.set('seller', (world.ethBalances.get('seller') ?? 0n) + 3n);
  world.ethBalances.set('buyer', (world.ethBalances.get('buyer') ?? 0n) - 3n);
  fleet.advanceEthHead(snapshotBlock);

  return {
    neverDelivered: !inserted && fleet.store.get(msg.messageId) == null,
    solUnchanged: world.solEscrows.get('f5')?.status === 'Pending' && !world.solProcessed.has(msg.messageId),
  };
}
