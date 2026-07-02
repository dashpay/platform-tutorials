/**
 * Shared Playwright fixtures for DashBounty E2E tests.
 *
 * These run against real Dash Platform testnet. No mocks — the app boots
 * normally and connects via @dashevo/evo-sdk.
 *
 * Two independent gates:
 *   HAS_MNEMONIC — PLATFORM_MNEMONIC is set. Enough for single-identity
 *     flows (submit a report as the researcher).
 *   HAS_PANEL_IDENTITIES — all 4 identity IDs from
 *     scripts/bootstrap-identities.mjs are present. Required for the group
 *     2-of-3 signing flow, which needs a genuinely different signing
 *     identity for the second signature. This is a stricter, separate gate
 *     from HAS_MNEMONIC so casual contributors/CI aren't blocked by the
 *     heavier 4-identity setup cost — only the panel spec needs it.
 */
import { test as base, expect, type Page } from "@playwright/test";

interface AppFixture {
  page: Page;
}

export const test = base.extend<AppFixture>({
  page: async ({ page }, provide) => {
    await page.goto("/");
    await provide(page);
  },
});

export { expect, type Page };

export const HAS_MNEMONIC = Boolean(process.env.PLATFORM_MNEMONIC?.trim());

export const PANELIST_IDS = [
  process.env.VITE_PANELIST_1_ID,
  process.env.VITE_PANELIST_2_ID,
  process.env.VITE_PANELIST_3_ID,
].filter((id): id is string => Boolean(id?.trim()));

export const HAS_PANEL_IDENTITIES = HAS_MNEMONIC && PANELIST_IDS.length === 3;

/**
 * Sign in via the Account tab with PLATFORM_MNEMONIC at the given identity
 * index. Caller should `test.skip(!HAS_MNEMONIC, …)` first.
 */
export async function loginAs(page: Page, identityIndex: number) {
  const mnemonic = process.env.PLATFORM_MNEMONIC?.trim();
  if (!mnemonic) throw new Error("PLATFORM_MNEMONIC is required for loginAs");

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByLabel("Mnemonic").fill(mnemonic);
  await page.getByLabel(/identity index/i).fill(String(identityIndex));
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Signed in")).toBeVisible({ timeout: 60_000 });
}
