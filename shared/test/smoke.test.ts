import { describe, expect, it } from 'vitest';
import { addresses } from '../src/addresses.ts';
import { NetworkIdSchema, PING } from '../src/index.ts';

describe('shared boot smoke', () => {
  it('exports boot primitives', () => {
    expect(PING).toBe('boot-ok');
    expect(NetworkIdSchema.parse('local')).toBe('local');
    expect(addresses.local.ethereum).toBe('0x0000000000000000000000000000000000000000');
  });
});
