import type { Page } from "@playwright/test";

/** Wait until the shell nav is visible (Providers mounted). */
export async function waitForAppHooks(page: Page): Promise<void> {
  await page.getByRole("link", { name: /Legal Title Bridge/i }).waitFor({
    state: "visible",
    timeout: 60_000,
  });
  // Give mount effects a tick to apply ?e2e* query flags.
  await page.waitForTimeout(100);
}
