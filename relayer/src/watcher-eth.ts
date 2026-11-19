/**
 * Ethereum outbound event watcher — waits for confirmations or `finalized` tag.
 */

export interface EthLogEvent {
  messageId: string;
  msgType: number;
  wire: Uint8Array;
  blockNumber: number;
}

export interface EthBlockSource {
  /** Latest block number (unsafe head). */
  getBlockNumber(): Promise<number>;
  /** Latest finalized block number when available; null if RPC has no tag. */
  getFinalizedBlockNumber(): Promise<number | null>;
  /** New OutboundEmitted-style events since last poll. */
  getOutboundEvents(fromBlock: number, toBlock: number): Promise<EthLogEvent[]>;
}

export type EthFinalityMode = 'confirmations' | 'finalized';

export interface WatcherEthOptions {
  rpc: EthBlockSource;
  /** Confirmations behind head when mode === 'confirmations'. */
  confirmations: number;
  mode?: EthFinalityMode;
  onFinalized: (ev: EthLogEvent) => void | Promise<void>;
}

/**
 * Pure finality check — exported for unit tests.
 * - confirmations: event is final when head - eventBlock >= confirmations
 * - finalized: event is final when eventBlock <= finalizedBlock
 */
export function isEthEventFinal(
  eventBlock: number,
  head: number,
  finalized: number | null,
  confirmations: number,
  mode: EthFinalityMode
): boolean {
  if (mode === 'finalized') {
    if (finalized == null) return false;
    return eventBlock <= finalized;
  }
  return head - eventBlock >= confirmations;
}

export class WatcherEth {
  private lastScanned = 0;
  private readonly mode: EthFinalityMode;

  constructor(private readonly opts: WatcherEthOptions) {
    this.mode = opts.mode ?? 'confirmations';
  }

  /** Advance the scan cursor (tests / bootstrap). */
  setLastScanned(block: number): void {
    this.lastScanned = block;
  }

  async poll(): Promise<number> {
    const head = await this.opts.rpc.getBlockNumber();
    const finalized = await this.opts.rpc.getFinalizedBlockNumber();
    const from = this.lastScanned + 1;
    if (from > head) return 0;

    const events = await this.opts.rpc.getOutboundEvents(from, head);
    let emitted = 0;
    for (const ev of events) {
      if (
        isEthEventFinal(ev.blockNumber, head, finalized, this.opts.confirmations, this.mode)
      ) {
        await this.opts.onFinalized(ev);
        emitted += 1;
      }
    }
    this.lastScanned = head;
    return emitted;
  }
}
