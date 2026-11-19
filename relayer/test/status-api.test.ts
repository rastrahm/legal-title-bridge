import { describe, expect, it, afterEach } from 'vitest';

import { MessageStore } from '../src/store.ts';
import { listenStatusApi, getStatusApiAllowedMethods } from '../src/status-api.ts';

describe('status-api GET-only', () => {
  let store: MessageStore | undefined;
  let closeServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (closeServer) {
      await closeServer();
      closeServer = undefined;
    }
    store?.close();
    store = undefined;
  });

  it('exports only GET as allowed method', () => {
    expect(getStatusApiAllowedMethods()).toEqual(['GET']);
  });

  it('serves /status and /messages; rejects POST/PUT/DELETE', async () => {
    store = new MessageStore({ path: ':memory:' });
    store.insertIdempotent({
      messageId: '0x1',
      direction: 'eth_to_sol',
      msgType: 0,
      wire: new Uint8Array([1]),
    });

    const { server, url } = await listenStatusApi({
      store,
      getReconcile: () => ({
        i2Ok: true,
        ethCirculating: 1n,
        solIssued: 1n,
        divergences: [],
      }),
    });
    closeServer = () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });

    const status = await fetch(`${url}/status`);
    expect(status.status).toBe(200);
    const statusBody = (await status.json()) as {
      source: string;
      messageCount: number;
      reconcile: { ethCirculating: string };
    };
    expect(statusBody.source).toBe('relayer');
    expect(statusBody.messageCount).toBe(1);
    expect(statusBody.reconcile.ethCirculating).toBe('1');

    const messages = await fetch(`${url}/messages`);
    expect(messages.status).toBe(200);
    const msgBody = (await messages.json()) as { messages: unknown[] };
    expect(msgBody.messages).toHaveLength(1);

    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      const res = await fetch(`${url}/status`, { method });
      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toBe('GET');
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('method_not_allowed');
    }

    const missing = await fetch(`${url}/admin`);
    expect(missing.status).toBe(404);
  });
});
