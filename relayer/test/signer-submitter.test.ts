import { describe, expect, it, afterEach } from 'vitest';
import { keccak256, getBytes, SigningKey } from 'ethers';

import { MessageStore } from '../src/store.ts';
import { RelayerSigner } from '../src/signer.ts';
import { Submitter } from '../src/submitter.ts';
import type { StoredMessage } from '../src/types.ts';

describe('signer + submitter quorum', () => {
  const stores: MessageStore[] = [];
  afterEach(() => {
    for (const s of stores) s.close();
    stores.length = 0;
  });

  it('signs digest without EIP-191 prefix', () => {
    const pk = '0x' + '11'.repeat(32);
    const signer = new RelayerSigner(pk);
    const digest = getBytes(keccak256('0xdead'));
    const sig = signer.signDigest(digest);
    expect(sig.startsWith('0x')).toBe(true);
    expect(getBytes(sig).length).toBe(65);
    // Recover via SigningKey path: eth_signMessage would differ
    const recovered = SigningKey.recoverPublicKey(digest, sig);
    expect(recovered).toBeTruthy();
  });

  it('reaches quorum_ready at threshold and delivers once', async () => {
    const store = new MessageStore({ path: ':memory:' });
    stores.push(store);
    const s1 = new RelayerSigner('0x' + '22'.repeat(32));
    const s2 = new RelayerSigner('0x' + '33'.repeat(32));
    const digest = getBytes(keccak256('0xbeef'));

    store.insertIdempotent({
      messageId: '0xmsg',
      direction: 'eth_to_sol',
      msgType: 0,
      wire: new Uint8Array([1]),
      status: 'finalized',
    });

    let deliveries = 0;
    const transport = {
      async deliver(_m: StoredMessage, sigs: string[]): Promise<void> {
        expect(sigs.length).toBeGreaterThanOrEqual(2);
        deliveries += 1;
      },
    };

    const sub1 = new Submitter({
      store,
      signer: s1,
      transport,
      threshold: 2,
      digestOf: () => digest,
    });
    const sub2 = new Submitter({
      store,
      signer: s2,
      transport,
      threshold: 2,
      digestOf: () => digest,
    });

    sub1.signLocal('0xmsg');
    expect(store.get('0xmsg')?.status).toBe('signed');
    expect(store.get('0xmsg')?.signatures).toHaveLength(1);

    const after = sub2.signLocal('0xmsg');
    expect(after?.status).toBe('quorum_ready');
    expect(after?.signatures).toHaveLength(2);

    expect(await sub1.tryDeliver('0xmsg')).toBe('delivered');
    expect(await sub2.tryDeliver('0xmsg')).toBe('skipped');
    expect(deliveries).toBe(1);
    expect(store.get('0xmsg')?.status).toBe('delivered');
  });

  it('marks retry on transport failure', async () => {
    const store = new MessageStore({ path: ':memory:', baseRetryMs: 100, capRetryMs: 1000 });
    stores.push(store);
    const signer = new RelayerSigner('0x' + '44'.repeat(32));
    const digest = getBytes(keccak256('0xcafe'));
    store.insertIdempotent({
      messageId: '0xfail',
      direction: 'eth_to_sol',
      msgType: 2,
      wire: new Uint8Array([2]),
    });
    const sub = new Submitter({
      store,
      signer,
      threshold: 1,
      digestOf: () => digest,
      transport: {
        async deliver(): Promise<void> {
          throw new Error('boom');
        },
      },
    });
    sub.signLocal('0xfail');
    expect(await sub.tryDeliver('0xfail')).toBe('retry');
    expect(store.get('0xfail')?.status).toBe('failed');
    expect(store.get('0xfail')?.attempts).toBe(1);
  });
});
