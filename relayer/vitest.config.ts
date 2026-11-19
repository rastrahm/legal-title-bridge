import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // node:sqlite is experimental; keep tests in-process.
    pool: 'forks',
  },
});
