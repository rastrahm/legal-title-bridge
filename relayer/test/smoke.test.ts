import { describe, expect, it } from 'vitest';

import { RELAYER_PING, getStatusApiAllowedMethods } from '../src/index.ts';

describe('relayer boot smoke', () => {
  it('exports a boot smoke value', () => {
    expect(RELAYER_PING).toBe('boot-ok');
  });

  it('keeps the status API read-only', () => {
    expect(getStatusApiAllowedMethods()).toEqual(['GET']);
  });
});
