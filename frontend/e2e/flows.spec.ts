import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { waitForAppHooks } from "./helpers";

const ASSET =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const shotsDir = join(process.cwd(), "../doc/front-screenshots");

test.beforeAll(() => {
  mkdirSync(shotsDir, { recursive: true });
});

test("home + views screenshots for portfolio", async ({ page }) => {
  await page.goto("/");
  await waitForAppHooks(page);
  await expect(page.getByRole("heading", { name: /Legal Title Bridge/i })).toBeVisible();
  await page.screenshot({ path: join(shotsDir, "home.png"), fullPage: true });

  await page.goto("/activos");
  await waitForAppHooks(page);
  await page.screenshot({ path: join(shotsDir, "activos.png"), fullPage: true });

  await page.goto(`/activos/${ASSET}`);
  await waitForAppHooks(page);
  await expect(page.getByTestId("asset-name")).toBeVisible();
  await page.screenshot({ path: join(shotsDir, "activo-detalle.png"), fullPage: true });

  await page.goto("/cartera");
  await waitForAppHooks(page);
  await page.screenshot({ path: join(shotsDir, "cartera.png"), fullPage: true });

  await page.goto("/operador");
  await waitForAppHooks(page);
  await page.screenshot({ path: join(shotsDir, "operador.png"), fullPage: true });

  await page.goto("/verificador");
  await waitForAppHooks(page);
  await page.screenshot({ path: join(shotsDir, "verificador.png"), fullPage: true });

  await page.goto("/puente");
  await waitForAppHooks(page);
  await page.screenshot({ path: join(shotsDir, "puente.png"), fullPage: true });
});

test("operator issue confirm panel shows decoded amount 5 (not form)", async ({
  page,
}) => {
  await page.goto("/operador?e2ePrepareIssue=1");
  await waitForAppHooks(page);
  await page.getByTestId("form-amount").fill("999");
  // Decoded confirmation stays at canonical amount 5 (W4), independent of the form field.
  await expect(page.getByTestId("confirm-arg-amount")).toHaveText("5");
  await expect(page.getByTestId("form-amount")).toHaveValue("999");
});

test("explorer ledger breaks when entry is tampered", async ({ page }) => {
  await page.goto(`/activos/${ASSET}?e2eBreakLedger=1`);
  await waitForAppHooks(page);
  await expect(page.getByTestId("ledger-status")).toContainText(/rota|broken/i);
});

test("invalid assetId shows error copy", async ({ page }) => {
  await page.goto("/activos/not-a-bytes32");
  await expect(page.getByRole("heading", { name: /inválido|invalid/i })).toBeVisible();
});
