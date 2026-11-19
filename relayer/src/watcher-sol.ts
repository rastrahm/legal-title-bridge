/**
 * Solana event watcher — only accepts `finalized` commitment (protocol).
 */

export type SolCommitment = 'processed' | 'confirmed' | 'finalized';

export interface SolBridgeEvent {
  messageId: string;
  msgType: number;
  wire: Uint8Array;
  slot: number;
}

export interface SolEventSource {
  getEvents(commitment: SolCommitment): Promise<SolBridgeEvent[]>;
}

export interface WatcherSolOptions {
  rpc: SolEventSource;
  /** Must be finalized in production; injectable for tests. */
  commitment?: SolCommitment;
  onFinalized: (ev: SolBridgeEvent) => void | Promise<void>;
}

export class WatcherSol {
  private readonly commitment: SolCommitment;
  private readonly seen = new Set<string>();

  constructor(private readonly opts: WatcherSolOptions) {
    this.commitment = opts.commitment ?? 'finalized';
  }

  async poll(): Promise<number> {
    if (this.commitment !== 'finalized') {
      // Defense: refuse to act on unsafe commitments in the default path.
      throw new Error(`WatcherSol refuses commitment=${this.commitment}; use finalized`);
    }
    const events = await this.opts.rpc.getEvents(this.commitment);
    let n = 0;
    for (const ev of events) {
      if (this.seen.has(ev.messageId)) continue;
      this.seen.add(ev.messageId);
      await this.opts.onFinalized(ev);
      n += 1;
    }
    return n;
  }
}
