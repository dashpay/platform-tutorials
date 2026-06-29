/**
 * Shared Playwright fixtures for dashrate E2E tests. Runs against real
 * testnet — no SDK mocks.
 *
 * The base `page` fixture navigates to `/` and waits for the resource list to
 * render. The shell is interactive before the ~8 MB SDK loads, so the wait
 * anchors on the first resource card (rendered immediately from the static
 * catalog) rather than on network-dependent text.
 */
import { test as base, expect, type Page } from "@playwright/test";

interface AppFixture {
  page: Page;
}

export const test = base.extend<AppFixture>({
  page: async ({ page }, provide) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "DashRate", level: 1 }),
    ).toBeVisible({ timeout: 60_000 });
    await expect(
      page.locator('aside[aria-label="Tutorial resources"] button').first(),
    ).toBeVisible({ timeout: 60_000 });
    await provide(page);
  },
});

export { expect, type Page };

/** Click a top-nav button by its label. */
export async function navTo(
  page: Page,
  label: "Resources" | "My reviews" | "Settings" | "How it works",
) {
  await page
    .locator('nav[aria-label="Primary navigation"]')
    .getByRole("button", { name: label, exact: true })
    .first()
    .click();
}

/** Select a resource card by its visible title. */
export async function selectResource(page: Page, title: string) {
  await page
    .locator('aside[aria-label="Tutorial resources"] button')
    .filter({ hasText: title })
    .first()
    .click();
}
