/**
 * Three-relayer fleet over MessageStore + Submitter (real relayer modules).
 */

import { keccak256, getBytes } from 'ethers';
import {
  MessageStore,
  RelayerSigner,
  Submitter,
  buildReconcileReport,
  type DeliveryTransport,
  type StoredMessage,
  type ReconcileReport,
} from '@legal-title-bridge/relayer';

import type { BridgeMessage, World } from './world.ts';

export interface FleetOptions {
  world: World;
  confirmations?: number;
  /** Private keys for 3 relayers. */
  keys?: [string, string, string];
}

const DEFAULT_KEYS: [string, string, string] = [
  '0x' + 'a1'.repeat(32),
  '0x' + 'a2'.repeat(32),
  '0x' + 'a3'.repeat(32),
];

export class RelayerFleet {
  readonly store: MessageStore;
  readonly signers: RelayerSigner[];
  readonly submitters: Submitter[];
  readonly world: World;
  readonly confirmations: number;
  /** Relayers currently online (F1). */
  online: boolean[];
  private ethHead: number;

  constructor(opts: FleetOptions) {
    this.world = opts.world;
    this.confirmations = opts.confirmations ?? 2;
    this.ethHead = opts.world.ethBlock;
    this.store = new MessageStore({ path: ':memory:', baseRetryMs: 10, capRetryMs: 100 });
    const keys = opts.keys ?? DEFAULT_KEYS;
    this.signers = keys.map((k) => new RelayerSigner(k));
    this.online = [true, true, true];

    const transport: DeliveryTransport = {
      deliver: async (msg) => this.deliverToDestination(msg),
    };

    this.submitters = this.signers.map(
      (signer) =>
        new Submitter({
          store: this.store,
          signer,
          transport,
          threshold: 2,
          digestOf: (m) => getBytes(keccak256(m.wire)),
        })
    );
  }

  close(): void {
    this.store.close();
  }

  /** Observe an outbound event; only finalize after confirmations (F5). */
  observe(ev: BridgeMessage, opts?: { forceFinal?: boolean }): boolean {
    this.ethHead = Math.max(this.ethHead, this.world.ethBlock);
    const finalized =
      opts?.forceFinal === true || this.ethHead - ev.emittedAt >= this.confirmations;
    if (!finalized) return false;
    this.store.insertIdempotent({
      messageId: ev.messageId,
      direction: ev.direction,
      msgType: ev.msgType,
      wire: ev.wire,
      status: 'finalized',
    });
    return true;
  }

  /** Advance eth head / confirmations without new events. */
  advanceEthHead(to: number): void {
    this.ethHead = to;
  }

  /** Online relayers sign; when quorum met, attempt delivery. */
  async pump(): Promise<void> {
    const msgs = this.store.list(200);
    for (const msg of msgs) {
      if (msg.status === 'delivered') continue;
      for (let i = 0; i < this.submitters.length; i++) {
        if (!this.online[i]) continue;
        this.submitters[i]!.signLocal(msg.messageId);
      }
      const cur = this.store.get(msg.messageId);
      if (cur && (cur.status === 'quorum_ready' || cur.signatures.length >= 2)) {
        // First online submitter delivers (permissionless).
        for (let i = 0; i < this.submitters.length; i++) {
          if (!this.online[i]) continue;
          await this.submitters[i]!.tryDeliver(msg.messageId);
          break;
        }
      }
    }
    // Retries
    for (const due of this.store.dueForRetry()) {
      for (let i = 0; i < this.submitters.length; i++) {
        if (!this.online[i]) continue;
        this.store.updateStatus(due.messageId, 'quorum_ready');
        await this.submitters[i]!.tryDeliver(due.messageId);
        break;
      }
    }
  }

  /** F2: two online relayers try to deliver the same message concurrently. */
  async raceDeliver(messageId: string): Promise<Array<'delivered' | 'skipped' | 'retry'>> {
    const active = this.submitters
      .map((s, i) => ({ s, i }))
      .filter((x) => this.online[x.i]);
    const results = await Promise.all(active.slice(0, 2).map((x) => x.s.tryDeliver(messageId)));
    return results;
  }

  reconcile(): ReconcileReport {
    const pairs = [...this.world.ethRequests.values()].map((r) => {
      const esc = this.world.solEscrows.get(r.transferId);
      return {
        transferId: r.transferId,
        ethStatus: r.status,
        solStatus: mapSol(esc?.status ?? 'None'),
      };
    });
    return buildReconcileReport(
      { ethCirculating: this.world.circulating(), solIssued: this.world.solIssued },
      pairs
    );
  }

  private async deliverToDestination(msg: StoredMessage): Promise<void> {
    // Destination processing by msgType / messageId prefix.
    if (msg.messageId.startsWith('decision:')) {
      const transferId = msg.messageId.split(':')[1]!;
      this.world.applyDecisionOnSol(transferId, msg.messageId);
      return;
    }
    if (msg.messageId.startsWith('issue:')) {
      this.world.applyIssueOnSol(msg.messageId);
      return;
    }
    if (msg.messageId.startsWith('forced:')) {
      const parts = msg.messageId.split(':');
      this.world.applyForcedOnSol(msg.messageId, parts[1]!, parts[2]!, BigInt(parts[3]!));
      return;
    }
    if (msg.messageId.startsWith('redeem:')) {
      this.world.applyRedeemOnSol(msg.messageId);
      return;
    }
    // Generic: mark processed on sol
    if (this.world.solProcessed.has(msg.messageId)) {
      throw new Error('MessageAlreadyProcessed');
    }
    this.world.solProcessed.add(msg.messageId);
  }
}

function mapSol(
  s: string
): 'Pending' | 'Completed' | 'Refunded' | 'CourtCancelledSol' | 'Unknown' | 'None' {
  if (s === 'Pending') return 'Pending';
  if (s === 'Completed') return 'Completed';
  if (s === 'Refunded') return 'Refunded';
  if (s === 'CourtCancelled') return 'CourtCancelledSol';
  if (s === 'None') return 'None';
  return 'Unknown';
}
