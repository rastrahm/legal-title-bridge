/**
 * QA phase — human-sim personas + scripts 1–10 against local Next lab UI.
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { waitForAppHooks } from "./helpers";

const ASSET =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const shots = join(process.cwd(), "../doc/qa-screenshots");

test.beforeAll(() => {
  mkdirSync(shots, { recursive: true });
});

async function shot(page: Page, name: string) {
  await page.screenshot({ path: join(shots, `${name}.png`), fullPage: true });
}

test.describe("QA personas", () => {
  test("Q-Titular: list balances, sell, cancel, retry other price", async ({
    page,
  }) => {
    await page.goto("/cartera");
    await waitForAppHooks(page);
    await page.getByTestId("btn-connect-sol").click();
    await expect(page.getByTestId("sol-address")).toContainText("seller-sol");
    await page.getByTestId("btn-sell").first().click();
    await expect(page.getByTestId("wallet-notice")).toContainText(/venta|sale/i);
    await page.getByTestId("btn-cancel-sale").first().click();
    await expect(page.getByTestId("wallet-notice")).toContainText(/cancel/i);
    await page.getByTestId("btn-retry-price").click();
    await expect(page.getByTestId("wallet-notice")).toContainText(/venta|sale/i);
    await shot(page, "q-titular");
  });

  test("Q-Comprador: start buy, leave, return, deposit notice", async ({
    page,
  }) => {
    await page.goto("/cartera");
    await waitForAppHooks(page);
    await page.getByTestId("btn-connect-sol").click();
    await page.getByTestId("btn-buy").first().click();
    await expect(page.getByTestId("wallet-notice")).toContainText(/compra|purchase|depósito|deposit/i);
    await page.goto("/");
    await waitForAppHooks(page);
    await page.goto("/cartera");
    await waitForAppHooks(page);
    await expect(page.getByRole("heading", { name: /cartera|wallet/i })).toBeVisible();
    await shot(page, "q-comprador");
  });

  test("Q-Operador: issue/pause/reconcile/court; foreign roles disabled", async ({
    page,
  }) => {
    await page.goto("/operador");
    await waitForAppHooks(page);
    await page.getByTestId("btn-connect-eth").click();
    await page.getByTestId("btn-issue").click();
    await expect(page.getByTestId("confirm-arg-amount")).toHaveText("5");
    await page.getByTestId("btn-pause").click();
    await page.getByTestId("btn-reconcile").click();
    await page.getByTestId("btn-court").click();
    await page.getByTestId("btn-strip-roles").click();
    await expect(page.getByTestId("btn-issue")).toBeDisabled();
    await expect(page.getByTestId("btn-pause")).toBeDisabled();
    await expect(page.getByTestId("btn-court")).toBeDisabled();
    await expect(page.getByTestId("btn-reconcile")).toBeDisabled();
    await shot(page, "q-operador");
  });

  test("Q-Verificador: incomplete blocks; expiry fields visible", async ({
    page,
  }) => {
    await page.goto("/verificador");
    await waitForAppHooks(page);
    await page.getByTestId("btn-connect-eth").click();
    await page.getByTestId("id-country").fill("");
    await expect(page.locator("#id-incomplete")).toBeVisible();
    await expect(page.getByTestId("btn-sign-identity")).toBeDisabled();
    await page.getByTestId("id-country").fill("ES");
    await page.getByTestId("id-expires").fill("1700000000");
    await page.getByTestId("btn-sign-identity").click();
    await expect(page.getByTestId("signed-ok")).toBeVisible();
    await shot(page, "q-verificador");
  });

  test("Q-Público: explorer, bridge, bad assetId, 404", async ({ page }) => {
    await page.goto("/activos");
    await waitForAppHooks(page);
    await page.goto(`/activos/${ASSET}`);
    await waitForAppHooks(page);
    await expect(page.getByTestId("asset-name")).toBeVisible();
    await page.goto("/activos/not-a-bytes32");
    await expect(page.getByRole("heading", { name: /inválido|invalid/i })).toBeVisible();
    await page.goto("/ruta-que-no-existe");
    await expect(page.getByRole("heading")).toBeVisible();
    await page.goto("/puente");
    await waitForAppHooks(page);
    await expect(page.getByTestId("chain-i2")).toBeVisible();
    await shot(page, "q-publico");
  });

  test("Q-Novato: wrong network blocks; recover on local chain", async ({
    page,
  }) => {
    await page.goto("/operador?e2eChain=1");
    await waitForAppHooks(page);
    await expect(page.getByTestId("network-banner")).toBeVisible();
    await expect(page.getByTestId("btn-issue")).toBeDisabled();
    await page.goto("/operador");
    await waitForAppHooks(page);
    await page.getByTestId("btn-connect-eth").click();
    await expect(page.getByTestId("btn-issue")).toBeEnabled();
    await shot(page, "q-novato");
  });
});

test.describe("QA scripts 1–10", () => {
  test("G1 happy path: issue confirm updates circulating demo", async ({
    page,
  }) => {
    await page.goto("/operador");
    await waitForAppHooks(page);
    await page.getByTestId("btn-connect-eth").click();
    await page.getByTestId("btn-issue").click();
    await page.getByTestId("btn-confirm-sign").click();
    await expect(page.getByTestId("confirm-arg-amount")).toHaveCount(0);
    await page.goto("/puente");
    await waitForAppHooks(page);
    await expect(page.getByTestId("chain-i2")).toContainText(/105|cuadran|match/i);
    await shot(page, "g1-happy");
  });

  test("G2 abandon mid-flow then cancel sale", async ({ page }) => {
    await page.goto("/cartera");
    await waitForAppHooks(page);
    await page.getByTestId("btn-connect-sol").click();
    await page.getByTestId("btn-sell").first().click();
    await page.goto("/puente");
    await waitForAppHooks(page);
    await page.goto("/cartera");
    await waitForAppHooks(page);
    await page.getByTestId("btn-connect-sol").click();
    await page.getByTestId("btn-cancel-sale").first().click();
    await expect(page.getByTestId("wallet-notice")).toContainText(/cancel/i);
  });

  test("G3 clear reject reason for expired certification", async ({ page }) => {
    await page.goto("/cartera");
    await waitForAppHooks(page);
    await expect(
      page.getByTestId("request-status-0xcert-expired"),
    ).toContainText(/certificación|certification/i);
  });

  test("G4 double submit does not open two confirms", async ({ page }) => {
    await page.goto("/operador");
    await waitForAppHooks(page);
    await page.getByTestId("btn-connect-eth").click();
    await page.getByTestId("btn-issue").click();
    await expect(page.getByTestId("btn-issue")).toBeDisabled();
    await expect(page.getByTestId("confirm-arg-amount")).toHaveCount(1);
  });

  test("G5 reload rebuilds from demo defaults (lab note)", async ({ page }) => {
    await page.goto("/operador");
    await waitForAppHooks(page);
    await page.getByTestId("btn-connect-eth").click();
    await page.reload();
    await waitForAppHooks(page);
    await expect(page.getByTestId("eth-address")).toHaveText("—");
  });

  test("G6 account switch clears draft", async ({ page }) => {
    await page.goto("/operador");
    await waitForAppHooks(page);
    await page.getByTestId("btn-connect-eth").click();
    await page.getByTestId("btn-issue").click();
    await expect(page.getByTestId("confirm-arg-amount")).toBeVisible();
    await page.getByTestId("btn-connect-eth").click(); // switch account
    await expect(page.getByTestId("op-notice")).toContainText(/borrador|draft/i);
    await expect(page.getByTestId("confirm-arg-amount")).toHaveCount(0);
  });

  test("G7 bridge messages show in-flight statuses + deadline hint", async ({
    page,
  }) => {
    await page.goto("/puente");
    await waitForAppHooks(page);
    await expect(page.getByTestId("msg-signed").or(page.getByTestId("msg-delivered")).first()).toBeVisible();
    await page.goto("/cartera");
    await waitForAppHooks(page);
    await expect(page.getByTestId("deadline-hint")).toBeVisible();
  });

  test("G8 relayer down shows actionable copy (not blank)", async ({
    page,
  }) => {
    await page.goto("/puente");
    await waitForAppHooks(page);
    await expect(page.getByTestId("relayer-status")).toContainText(/relayer|verdad|truth|unavailable|disponible/i);
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("G9 i18n ES↔EN mid-flow without mixed critical chrome", async ({
    page,
  }) => {
    await page.goto("/operador");
    await waitForAppHooks(page);
    await page.getByRole("group", { name: "Locale" }).getByRole("button", { name: "EN" }).click();
    await expect(page.getByRole("heading", { name: "Operator" })).toBeVisible();
    await expect(page.getByTestId("btn-issue")).toHaveText("Issue");
    await page.getByRole("group", { name: "Locale" }).getByRole("button", { name: "ES" }).click();
    await expect(page.getByRole("heading", { name: "Operador" })).toBeVisible();
    await expect(page.getByTestId("btn-issue")).toHaveText("Emitir");
  });

  test("G10 keyboard focus reaches critical fields + alert linked", async ({
    page,
  }) => {
    await page.goto("/verificador");
    await waitForAppHooks(page);
    await page.getByTestId("id-country").focus();
    await expect(page.getByTestId("id-country")).toBeFocused();
    await page.getByTestId("id-country").clear();
    await expect(page.locator("#id-incomplete")).toBeVisible();
    await expect(page.getByTestId("id-country")).toHaveAttribute(
      "aria-describedby",
      "id-incomplete",
    );
  });
});
