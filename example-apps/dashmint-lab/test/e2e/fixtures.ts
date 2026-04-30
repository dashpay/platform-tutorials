/**
 * Shared Playwright fixtures for dashmint-lab E2E tests.
 *
 * These run against real Dash Platform testnet. No mocks — the app boots
 * normally, connects via @dashevo/evo-sdk, and queries the default
 * pre-deployed card contract.
 *
 * Login helper mirrors dashproof-lab/e2e/fixtures.ts. The submit-button
 * label and post-auth signal are dashmint-lab-specific (the LoginModal
 * here uses "Login" + IdentityCard renders "Signed in" once authenticated).
 */
import { test as base, expect, type Page } from "@playwright/test";

interface AppFixture {
  page: Page;
}

// Re-export the raw Playwright test so specs that need to manipulate
// localStorage / viewport before navigation can bypass the "Connected"
// pre-condition baked into the default fixture.
export { base as rawTest };

export const test = base.extend<AppFixture>({
  page: async ({ page }, use) => {
    await page.goto("/");
    // Wait until the SDK has connected (sidebar shows "Connected") so any
    // Collection query the spec triggers has a live SDK to talk to.
    await expect(page.getByText("Connected").first()).toBeVisible({
      timeout: 60_000,
    });
    await use(page);
  },
});

export { expect, type Page };

export const HAS_MNEMONIC = Boolean(process.env.PLATFORM_MNEMONIC?.trim());

/**
 * Open the LoginModal via the sidebar nav button, fill the mnemonic from
 * PLATFORM_MNEMONIC, submit, and wait for the authenticated signal in the
 * IdentityCard. Caller should `test.skip(!HAS_MNEMONIC, …)` first.
 */
export async function loginViaModal(page: Page) {
  const mnemonic = process.env.PLATFORM_MNEMONIC?.trim();
  if (!mnemonic) {
    throw new Error("PLATFORM_MNEMONIC is required for loginViaModal");
  }

  // Click the sidebar nav Login button. The IdentityCard's own Login button
  // also reads "Login" — scope to <nav> to avoid the strict-locator collision.
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /login/i })
    .click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder("mnemonic phrase").fill(mnemonic);
  await dialog.getByRole("button", { name: /^Login$/ }).click();

  // Post-auth: dialog hides + IdentityCard shows "Signed in" eyebrow.
  await expect(dialog).toBeHidden({ timeout: 60_000 });
  await expect(page.getByText("Signed in")).toBeVisible({ timeout: 60_000 });
}
