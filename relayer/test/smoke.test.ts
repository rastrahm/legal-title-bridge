import { describe, expect, it } from 'vitest';

import { addresses, PING as SHARED_PING } from '@legal-title-bridge/shared';

import { RELAYER_PING, getStatusApiAllowedMethods } from '../src/index.ts';

describe('relayer boot smoke', () => {
  it('exports a boot smoke value', () => {
    expect(RELAYER_PING).toBe('boot-ok');
  });

  it('keeps the status API read-only', () => {
    expect(getStatusApiAllowedMethods()).toEqual(['GET']);
  });

  it('imports addresses from @legal-title-bridge/shared (no local copy)', () => {
    expect(SHARED_PING).toBe('boot-ok');
    expect(addresses['sepolia-devnet'].bridgeEndpoint).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });
});
