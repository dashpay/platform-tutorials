import { test, expect, type Page } from "./fixtures";
import { test as liteTest } from "@playwright/test";

// Live rating-consistency checks against testnet. Unlike the smoke specs,
// these DO read live rating data, but only assert an invariant that holds
// for any data: the per-star distribution (grouped `count` by rating) must
// sum to the total review count (ungrouped `count`). Both come from separate
// queries, so a change in how Platform keys grouped-count results (e.g. the
// PV14 index-key encoding change, dashpay/platform#5350) shows up here as a
// non-zero total with an all-zero distribution.
//
// The default contract's reviews can't be deleted (`canBeDeleted: false`),
// so at least one resource always has reviews to check.

const LOAD_TIMEOUT = 90_000;

function parseCount(text: string): number {
  const match = /(\d+)\s+reviews?/.exec(text);
  return match ? Number(match[1]) : 0;
}

async function sumCounts(page: Page, selector: string): Promise<number> {
  const texts = await page.locator(selector).allTextContents();
  return texts.reduce((sum, text) => sum + (parseInt(text, 10) || 0), 0);
}

test.describe("rating consistency (app)", () => {
  test("resources with reviews show a rating, and the distribution sums to the total", async ({
    page,
  }) => {
    const sidebar = page.locator('aside[aria-label="Tutorial resources"]');
    const rated = sidebar.locator("small.rating-present");
    await expect(rated.first()).toBeVisible({ timeout: LOAD_TIMEOUT });

    // A card counted as having reviews (total > 0) must not fall back to
    // "No reviews yet", which it does when the distribution is all zero.
    for (const card of await rated.all()) {
      await expect(card).not.toContainText("No reviews yet");
    }

    await sidebar
      .locator("button.resource-card")
      .filter({ has: page.locator("small.rating-present") })
      .first()
      .click();

    const stats = page.locator('[aria-label="Aggregate rating stats"]');
    await expect(stats.locator(".detail-rating-score")).not.toHaveText("—", {
      timeout: LOAD_TIMEOUT,
    });
    const total = parseCount(
      (await stats.locator(".detail-rating-count").textContent()) ?? "",
    );
    expect(total).toBeGreaterThan(0);
    await expect
      .poll(() => sumCounts(page, ".rating-histogram .histogram-count"), {
        timeout: LOAD_TIMEOUT,
      })
      .toBe(total);
  });
});

liteTest.describe("rating consistency (dashrate-lite)", () => {
  liteTest(
    "the distribution sums to the total for a resource with reviews",
    async ({ page }) => {
      liteTest.setTimeout(240_000);
      await page.goto("/dashrate-lite.html");
      await expect(page.locator("#status")).toHaveText(/Connected to testnet/, {
        timeout: LOAD_TIMEOUT,
      });

      const grid = page.locator("#aggregate-result .summary-grid");
      const navButtons = page.locator(
        'nav[aria-label="Tutorial resources"] button',
      );
      let checked = false;
      for (const button of await navButtons.all()) {
        await button.click();
        await expect(grid).toBeVisible({ timeout: LOAD_TIMEOUT });
        const total = parseCount(
          (await grid.locator(".score .label").textContent()) ?? "",
        );
        if (total === 0) continue;

        await expect(grid.locator(".score .value")).not.toHaveText("-");
        expect(
          await sumCounts(page, "#aggregate-result .dist-row .muted"),
        ).toBe(total);
        checked = true;
        break;
      }
      expect(checked, "expected at least one resource with reviews").toBe(true);
    },
  );
});
