import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const e2eRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const stackSh = join(e2eRoot, 'stack.sh');
const readyFile = join(e2eRoot, '.stack', 'ready');

describe('e2e/stack.sh', () => {
  it('boots sim mode and writes ready marker (C10 gate)', () => {
    execFileSync(stackSh, [], {
      env: { ...process.env, E2E_STACK_MODE: 'sim' },
      cwd: e2eRoot,
      encoding: 'utf8',
    });
    expect(existsSync(readyFile)).toBe(true);
    const env = readFileSync(join(e2eRoot, '.stack', 'env'), 'utf8');
    expect(env).toContain('E2E_STACK_MODE=sim');
    expect(env).toContain('E2E_RELAYERS=3');
  });
});
