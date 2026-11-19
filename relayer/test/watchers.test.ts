import { describe, expect, it } from 'vitest';

import { isEthEventFinal, WatcherEth } from '../src/watcher-eth.ts';
import type { EthLogEvent } from '../src/watcher-eth.ts';
import { WatcherSol } from '../src/watcher-sol.ts';

describe('watchers finality', () => {
  it('isEthEventFinal confirmations mode', () => {
    expect(isEthEventFinal(100, 111, null, 12, 'confirmations')).toBe(false);
    expect(isEthEventFinal(100, 112, null, 12, 'confirmations')).toBe(true);
  });

  it('isEthEventFinal finalized mode (Sepolia tag)', () => {
    expect(isEthEventFinal(100, 200, null, 12, 'finalized')).toBe(false);
    expect(isEthEventFinal(100, 200, 99, 12, 'finalized')).toBe(false);
    expect(isEthEventFinal(100, 200, 100, 12, 'finalized')).toBe(true);
  });

  it('WatcherEth only emits finalized events', async () => {
    const seen: string[] = [];
    const events: EthLogEvent[] = [
      { messageId: 'a', msgType: 0, wire: new Uint8Array([1]), blockNumber: 10 },
      { messageId: 'b', msgType: 0, wire: new Uint8Array([2]), blockNumber: 50 },
    ];
    const watcher = new WatcherEth({
      confirmations: 12,
      mode: 'confirmations',
      onFinalized: (ev) => {
        seen.push(ev.messageId);
      },
      rpc: {
        async getBlockNumber() {
          return 25; // only block 10 is final (25-10>=12); 50 is not
        },
        async getFinalizedBlockNumber() {
          return null;
        },
        async getOutboundEvents() {
          return events;
        },
      },
    });
    watcher.setLastScanned(0);
    const n = await watcher.poll();
    expect(n).toBe(1);
    expect(seen).toEqual(['a']);
  });

  it('WatcherSol refuses non-finalized commitment', async () => {
    const w = new WatcherSol({
      commitment: 'confirmed',
      rpc: {
        async getEvents() {
          return [];
        },
      },
      onFinalized: () => undefined,
    });
    await expect(w.poll()).rejects.toThrow(/finalized/);
  });

  it('WatcherSol dedupes message ids', async () => {
    const seen: string[] = [];
    const w = new WatcherSol({
      rpc: {
        async getEvents() {
          return [
            { messageId: 'x', msgType: 1, wire: new Uint8Array([1]), slot: 1 },
            { messageId: 'x', msgType: 1, wire: new Uint8Array([1]), slot: 1 },
          ];
        },
      },
      onFinalized: (ev) => {
        seen.push(ev.messageId);
      },
    });
    expect(await w.poll()).toBe(1);
    expect(await w.poll()).toBe(0);
    expect(seen).toEqual(['x']);
  });
});
