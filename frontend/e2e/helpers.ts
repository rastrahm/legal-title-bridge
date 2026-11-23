import type { Page } from "@playwright/test";

/** Wait until the client Providers shell has hydrated (toolbar is intentionally hidden). */
export async function waitForAppHooks(page: Page): Promise<void> {
  await page.getByRole("link", { name: /Legal Title Bridge/i }).waitFor({
    state: "visible",
    timeout: 60_000,
  });
  await page
    .locator('[data-testid="e2e-toolbar"][data-hydrated="1"]')
    .waitFor({ state: "attached", timeout: 60_000 });
}
