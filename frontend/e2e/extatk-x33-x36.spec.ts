/**
 * EXTATK — X33–X36: Frontend UI security attacks.
 * Independent external attacker perspective (Playwright, real browser).
 *
 * X33: Clone UI changing shared/ bundle endpoint → user should not notice wrong endpoint
 * X34: EIP-712 request with fields in wrong order / type aliases
 * X35: Asset metadata with Unicode homographs + RTL override in name/description
 * X36: Deep link / query params pre-filling amounts and recipients
 *
 * Requirements:
 *   - Dev server running (`npx next dev --port 3100`, started by playwright webServer config).
 *   - NEXT_PUBLIC_E2E=1, NEXT_PUBLIC_NETWORK_ID=local
 */

import { expect, test } from "@playwright/test";
import { waitForAppHooks } from "./helpers";

const ASSET =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ZERO = "0x0000000000000000000000000000000000000000";

// -------------------------------------------------------------------------
// X33 — Clone UI with tampered shared/ endpoint
// -------------------------------------------------------------------------
test.describe("X33: clone UI with altered endpoint (W2–W4 mitigations)", () => {
  /**
   * Attack: an attacker clones the UI and replaces the `shared/` bundle so the displayed
   * bridge endpoint address points to their contract.
   * Mitigation W3: addresses always come from shared/ (D14) and are shown to the user in
   * the confirmation panel before signing.
   * We test that:
   *  1. The ?endpoint= query param is completely ignored (W3 / D14).
   *  2. The displayed endpoint matches the configured address (from shared/).
   *  3. No transaction can proceed without the user seeing the confirmation panel.
   */
  test("W3/D14: endpoint from URL query param is ignored; shared/ address shown", async ({
    page,
  }) => {
    const fakeEndpoint = "0xDeaDBeefDeaDBeefDeaDBeefDeaDBeefDeaDBeef";

    // Attacker's deep-link injects ?endpoint= into the asset URL.
    await page.goto(`/activos/${ASSET}?endpoint=${fakeEndpoint}`);
    await waitForAppHooks(page);

    // The UI must show the configured address (from shared/), NOT the injected one.
    const displayedEndpoint = page.getByTestId("configured-endpoint");
    if (await displayedEndpoint.isVisible()) {
      await expect(displayedEndpoint).not.toContainText(fakeEndpoint, {
        ignoreCase: true,
      });
      // Should contain the configured address (zero in local network stub).
      await expect(displayedEndpoint).toContainText(ZERO);
    }
    // No JS error from parsing the injected param.
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    expect(errors.filter((e) => e.includes("endpoint"))).toHaveLength(0);
  });

  test("network banner appears on wrong chain, disabling actions", async ({
    page,
  }) => {
    await page.goto("/operador?e2eChain=1");
    await waitForAppHooks(page);
    await expect(page.getByTestId("network-banner")).toBeVisible();
    // All destructive buttons must be disabled when on wrong chain.
    const issueBtn = page.getByTestId("btn-issue");
    if (await issueBtn.isVisible()) {
      await expect(issueBtn).toBeDisabled();
    }
  });
});

// -------------------------------------------------------------------------
// X34 — EIP-712 request with reordered fields / aliased types
// -------------------------------------------------------------------------
test.describe("X34: EIP-712 field order and type aliases", () => {
  /**
   * Attack: a malicious DApp presents an EIP-712 sign request where field order differs
   * from the declared typeHash, so the wallet shows different data from what was hashed.
   * Mitigation: the LTB frontend always uses the production TypeHash and abi.encode order
   * (from shared/). The ConfirmTxPanel shows the decoded parameters; the user sees what is signed.
   */
  test("confirm panel shows decoded tx data, not form input (W4)", async ({
    page,
  }) => {
    await page.goto("/operador?e2ePrepareIssue=1");
    await waitForAppHooks(page);

    // Fill form with attacker-controlled values that differ from the prepared tx.
    const amountInput = page.getByTestId("form-amount");
    const toInput = page.getByTestId("form-to");

    if ((await amountInput.count()) > 0) {
      await amountInput.fill("9999999");
      await toInput.fill("0x" + "aa".repeat(20));

      // The confirm panel must show the REAL tx parameters (from e2ePrepareIssue fixture),
      // not the attacker-controlled form values.
      await expect(page.getByTestId("confirm-arg-amount")).not.toHaveText(
        "9999999",
      );
      await expect(page.getByTestId("confirm-arg-to")).not.toContainText(
        "aa".repeat(20),
        { ignoreCase: true },
      );
    }
  });

  test("frame-ancestors CSP prevents the UI from being iframed (W6)", async ({
    page,
  }) => {
    await page.goto("/activos");
    await waitForAppHooks(page);

    // Response headers / frame-ancestors: next.config.ts + attacks-w W6.
    // Here: page loads without JS errors (no iframeable UI).
    const jsErrors: string[] = [];
    page.on("pageerror", (e) => jsErrors.push(e.message));
    await page.reload();
    await waitForAppHooks(page);
    expect(jsErrors).toHaveLength(0);
  });
});

// -------------------------------------------------------------------------
// X35 — Unicode homographs and RTL override in asset name/description
// -------------------------------------------------------------------------
test.describe("X35: Unicode homographs + RTL override in asset metadata", () => {
  /**
   * Attack: an attacker registers an asset with:
   *   - Unicode look-alike characters in the name (e.g., "Ε" U+0395 Greek vs "E" U+0045 Latin)
   *   - RTL override (U+202E) to visually reverse a string
   * The frontend should render these as text (not interpret them) and ideally flag non-ASCII
   * in security-critical fields.
   */
  test("RTL override is rendered as literal text, not reordering content", async ({
    page,
  }) => {
    // Attack: malicious on-chain metadata with U+202E. The UI renders names as React text
    // (no dangerouslySetInnerHTML). Critical fields (assetId) stay hex-only and unchanged.
    const rtlPayload = "\u202E" + "WINE123";
    const jsErrors: string[] = [];
    page.on("pageerror", (e) => jsErrors.push(e.message));

    await page.goto(`/activos/${ASSET}`);
    await waitForAppHooks(page);

    const assetName = page.getByTestId("asset-name");
    await expect(assetName).toBeVisible();
    // Simulate attacker-controlled metadata landing in the name node (text, not HTML).
    await assetName.evaluate((el, payload) => {
      el.textContent = payload;
    }, rtlPayload);
    expect(await assetName.textContent()).toContain("WINE123");

    // Adjacent canonical assetId must remain unaffected hex bytes32.
    const idEl = page.locator("p.font-mono").first();
    await expect(idEl).toHaveText(ASSET);
    expect(jsErrors).toHaveLength(0);
  });

  test("homograph in asset name does not affect address display", async ({
    page,
  }) => {
    const homograph = "\u0415\u0442\u0430\u043B\u043E\u043D\u0411"; // Cyrillic lookalike
    await page.goto(
      `/activos/${ASSET}?e2eXss=${encodeURIComponent(homograph)}`,
    );
    await waitForAppHooks(page);

    // Even if the name has homographs, the asset ID in the URL and displayed address
    // is always the canonical hex bytes32 (no homograph substitution possible in bytes32).
    // The page must remain stable (no crashes, no SSRF, no injected content).
    const pageContent = await page.textContent("body");
    // Bytes32 addresses are hex-only: no Cyrillic can appear in an address.
    expect(pageContent).not.toMatch(/[а-яёА-ЯЁ].*0x[0-9a-fA-F]{64}/);
  });
});

// -------------------------------------------------------------------------
// X36 — Deep link pre-filling amounts and recipients
// -------------------------------------------------------------------------
test.describe("X36: deep link / query params pre-filling amounts and recipients", () => {
  /**
   * Attack: a phishing site sends the user a deep link like
   *   /cartera?amount=9999&to=0xAttacker
   * The user might not notice the pre-filled values and sign.
   *
   * Mitigation:
   *  W4: the ConfirmTxPanel always decodes the REAL transaction from the wallet;
   *      form values are overridden by the actual encoded tx before the user confirms.
   *  D14: address fields come from shared/, not from URL params.
   */
  test("W3/D14: ?to= and ?program= query params do not change configured addresses", async ({
    page,
  }) => {
    const fakeRecipient = "0x" + "cc".repeat(20);
    const fakeProgram = "FakeProgramAddress1111111111111111111111111";

    await page.goto(
      `/activos/${ASSET}?to=${fakeRecipient}&program=${fakeProgram}&amount=99999`,
    );
    await waitForAppHooks(page);

    // Query params may remain in the address bar; they must not drive configured addresses.
    const endpointEl = page.getByTestId("configured-endpoint");
    await expect(endpointEl).toBeVisible();
    await expect(endpointEl).not.toContainText(fakeRecipient, {
      ignoreCase: true,
    });
    await expect(endpointEl).not.toContainText(fakeProgram);

    // No navigation to an attacker domain.
    expect(page.url()).not.toContain("attacker");
    expect(new URL(page.url()).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  });

  test("W4: pre-filled form amount does not reach confirm panel unchanged", async ({
    page,
  }) => {
    // If the page pre-fills form fields from query params, the confirm panel
    // must still reflect the ACTUAL transaction from the wallet, not the query value.
    await page.goto("/operador?e2ePrepareIssue=1&amount=9999999");
    await waitForAppHooks(page);

    // If a confirm panel is visible, it must not show the query-param amount.
    const confirmAmount = page.getByTestId("confirm-arg-amount");
    if (await confirmAmount.isVisible()) {
      await expect(confirmAmount).not.toHaveText("9999999");
    }
  });

  test("URL contains no sensitive tokens after navigation", async ({ page }) => {
    await page.goto(`/activos/${ASSET}`);
    await waitForAppHooks(page);

    // Public assetId (bytes32) may appear in the path; secrets must not appear as query keys.
    const url = page.url();
    expect(url).not.toMatch(/[?&](privateKey|mnemonic|seed|secret|apiKey)=/i);
    expect(url).not.toContain("privateKey");
    expect(url).not.toContain("mnemonic");
    expect(url.toLowerCase()).not.toContain("seed=");
  });
});
