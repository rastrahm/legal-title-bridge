import { defineConfig, devices } from "@playwright/test";

/**
 * Ephemeral screenshot run against an already-started server on :3100
 * (avoids Next.js single-dev-dir lock while `npm run dev` occupies :3000).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
