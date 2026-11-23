import { expect, test } from "@playwright/test";
import { join } from "node:path";

import { waitForAppHooks } from "./helpers";

const ASSET =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ZERO = "0x0000000000000000000000000000000000000000";

test.describe("W1–W6 frontend attacks", () => {
  test("W1: XSS payload rendered as text; vulnerable HTML executes", async ({
    page,
  }) => {
    const payload = '<img src=x onerror="window.__xss=1">';
    await page.goto(`/activos/${ASSET}?e2eXss=1`);
    await waitForAppHooks(page);
    await expect(page.getByTestId("asset-name")).toHaveText(payload);
    const xss = await page.evaluate(() =>
      Boolean((window as unknown as { __xss?: number }).__xss),
    );
    expect(xss).toBe(false);

    const vuln = join(process.cwd(), "e2e/vulnerable/xss-name.html");
    await page.goto(`file://${vuln}`);
    await expect
      .poll(async () =>
        page.evaluate(() => Boolean((window as unknown as { __xss?: number }).__xss)),
      )
      .toBe(true);
  });

  test("W2: wrong chain disables operator issue", async ({ page }) => {
    await page.goto("/operador?e2eChain=1");
    await waitForAppHooks(page);
    await expect(page.getByTestId("network-banner")).toBeVisible();
    await expect(page.getByTestId("btn-issue")).toBeDisabled();
  });

  test("W3: URL endpoint injection ignored", async ({ page }) => {
    await page.goto(
      `/activos/${ASSET}?endpoint=0xAtaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&program=Evil`,
    );
    await waitForAppHooks(page);
    await expect(page.getByTestId("configured-endpoint")).toContainText(ZERO);
  });

  test("W4: confirmation uses decoded tx not form", async ({ page }) => {
    await page.goto("/operador?e2ePrepareIssue=1");
    await waitForAppHooks(page);
    await page.getByTestId("form-amount").fill("42");
    await page.getByTestId("form-to").fill(
      "0x3333333333333333333333333333333333333333",
    );
    await expect(page.getByTestId("confirm-arg-amount")).toHaveText("5");
    // issue(assetId, amount, toHolder) — decoded holder bytes32, not the form field.
    await expect(page.getByTestId("confirm-arg-toHolder")).toHaveText(
      /0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/i,
    );
  });

  test("W5: frame-ancestors none and X-Frame-Options DENY", async ({
    request,
  }) => {
    const res = await request.get("/");
    const csp = res.headers()["content-security-policy"] ?? "";
    const xfo = res.headers()["x-frame-options"] ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(xfo.toUpperCase()).toBe("DENY");
  });

  test("W6: fake relayer status does not override chain I2", async ({
    page,
  }) => {
    await page.goto("/puente?e2eFakeRelayer=1");
    await waitForAppHooks(page);
    await expect(page.getByTestId("chain-i2")).toContainText(/cuadran|match/i);
    await expect(page.getByTestId("relayer-status")).toContainText("999");
  });
});
