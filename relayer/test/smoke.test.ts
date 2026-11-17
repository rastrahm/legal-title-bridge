import { describe, expect, it } from 'vitest';
import { RELAYER_PING } from '../src/index.ts';
import { getStatusApiAllowedMethods } from '../src/status-api.ts';

describe('relayer boot smoke', () => {
  it('exports a boot smoke value', () => {
    expect(RELAYER_PING).toBe('boot-ok');
  });

  it('keeps the status API read-only for BOOT', () => {
    expect(getStatusApiAllowedMethods()).toEqual(['GET']);
  });
});
