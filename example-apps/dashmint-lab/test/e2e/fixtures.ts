/**
 * Shared Playwright fixtures for dashmint-lab E2E tests.
 *
 * These run against real Dash Platform testnet. No mocks — the app boots
 * normally, connects via @dashevo/evo-sdk, and queries the default
 * pre-deployed card contract.
 *
 * The fixture currently only handles navigation and a generous default
 * timeout while testnet round-trips complete. Login + write helpers will
 * land in a follow-up once the read-only suite is green.
 */
import { test as base, expect, type Page } from "@playwright/test";

interface AppFixture {
  page: Page;
}

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
