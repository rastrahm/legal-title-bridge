import { describe, expect, it, afterEach } from 'vitest';

import { MessageStore, nextRetryDelayMs } from '../src/store.ts';

describe('MessageStore idempotency + retries', () => {
  const stores: MessageStore[] = [];
  afterEach(() => {
    for (const s of stores) s.close();
    stores.length = 0;
  });

  function open(now?: () => number): MessageStore {
    const s = new MessageStore(
      now
        ? { path: ':memory:', now, baseRetryMs: 1000, capRetryMs: 8000 }
        : { path: ':memory:', baseRetryMs: 1000, capRetryMs: 8000 }
    );
    stores.push(s);
    return s;
  }

  it('inserts once per messageId (I3 / F1 / F2)', () => {
    const store = open();
    const wire = new Uint8Array([1, 2, 3]);
    expect(
      store.insertIdempotent({
        messageId: '0xabc',
        direction: 'eth_to_sol',
        msgType: 0,
        wire,
      })
    ).toBe(true);
    expect(
      store.insertIdempotent({
        messageId: '0xabc',
        direction: 'eth_to_sol',
        msgType: 0,
        wire,
      })
    ).toBe(false);
    expect(store.count()).toBe(1);
    expect(store.get('0xabc')?.status).toBe('seen');
  });

  it('schedules exponential backoff on markRetry', () => {
    let t = 1_000_000;
    const store = open(() => t);
    store.insertIdempotent({
      messageId: '0x1',
      direction: 'sol_to_eth',
      msgType: 1,
      wire: new Uint8Array([9]),
    });

    const first = store.markRetry('0x1', 'rpc down');
    expect(first?.attempts).toBe(1);
    expect(first?.nextRetryAt).toBe(t + 1000);
    expect(first?.status).toBe('failed');

    t = first!.nextRetryAt! + 1;
    expect(store.dueForRetry()).toHaveLength(1);

    const second = store.markRetry('0x1', 'still down');
    expect(second?.attempts).toBe(2);
    expect(second?.nextRetryAt).toBe(t + 2000);
  });

  it('nextRetryDelayMs respects cap', () => {
    expect(nextRetryDelayMs(1, 1000, 8000)).toBe(1000);
    expect(nextRetryDelayMs(2, 1000, 8000)).toBe(2000);
    expect(nextRetryDelayMs(4, 1000, 8000)).toBe(8000);
    expect(nextRetryDelayMs(10, 1000, 8000)).toBe(8000);
  });
});
