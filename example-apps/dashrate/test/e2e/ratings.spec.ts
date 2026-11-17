import { test, expect, type Page } from "./fixtures";
import { test as liteTest } from "@playwright/test";

// Live rating-consistency checks against testnet. Unlike the smoke specs,
// these DO read live rating data, but only assert invariants that hold for
// any data, each between two independent queries:
//  - Σ per-star distribution (grouped `count` by rating) == the review count
//    from `average`. A change in how Platform keys grouped-count results
//    (e.g. the PV14 index-key encoding change, dashpay/platform#5350) shows
//    up as a non-zero total with an all-zero distribution.
//  - "Most reviewed" (`ranked`, count axis) == the `average` count.
//  - "Top rated" (`ranked`, avg axis) == sum / count from `average`, both
//    rounded to one decimal (the ranked value is truncated fixed-point, so
//    never compare unrounded).
//  - "4★+ average" (`having`) lists only resources whose average is >= 4.
//
// The default contract's reviews can't be deleted (`canBeDeleted: false`),
// so at least one resource always has reviews to check.

const LOAD_TIMEOUT = 60_000;

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
    test.setTimeout(120_000);
    const sidebar = page.locator('aside[aria-label="Tutorial resources"]');
    const rated = sidebar.locator("small.rating-present");
    await expect(rated.first()).toBeVisible({ timeout: LOAD_TIMEOUT });

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

/** Read the selected resource's detail score and review count. */
async function detailStats(page: Page) {
  const stats = page.locator('[aria-label="Aggregate rating stats"]');
  await expect(stats.locator(".detail-rating-score")).not.toHaveText("—", {
    timeout: LOAD_TIMEOUT,
  });
  return {
    score: (await stats.locator(".detail-rating-score").textContent()) ?? "",
    count: parseCount(
      (await stats.locator(".detail-rating-count").textContent()) ?? "",
    ),
  };
}

test.describe("leaderboards and HAVING (app)", () => {
  test("each leaderboard row matches the resource's own average and count", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const board = page.locator('section[aria-label="Leaderboards"]');
    const rows = board.locator(".leaderboard-row");
    await expect(rows.first()).toBeVisible({ timeout: LOAD_TIMEOUT });

    // Top rated: ranked avg (rounded) == average sum/count (rounded).
    for (let i = 0; i < (await rows.count()); i++) {
      const row = rows.nth(i);
      const value = (
        (await row.locator(".leaderboard-value").textContent()) ?? ""
      )
        .replace("★", "")
        .trim();
      await row.click();
      await expect(
        page.locator(
          '[aria-label="Aggregate rating stats"] .detail-rating-score',
        ),
      ).toHaveText(value, { timeout: LOAD_TIMEOUT });
    }

    // Most reviewed: ranked count == average count.
    await board.getByRole("button", { name: "Most reviewed" }).click();
    for (let i = 0; i < (await rows.count()); i++) {
      const row = rows.nth(i);
      const count = parseCount(
        (await row.locator(".leaderboard-value").textContent()) ?? "",
      );
      expect(count).toBeGreaterThan(0);
      await row.click();
      await expect
        .poll(async () => (await detailStats(page)).count, {
          timeout: LOAD_TIMEOUT,
        })
        .toBe(count);
    }
  });

  test("the 4★+ filter keeps only resources averaging at least 4", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const chip = page.getByRole("button", { name: "4★+ average" });
    await expect(chip).toBeEnabled({ timeout: LOAD_TIMEOUT });
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");

    const cards = page.locator(
      'aside[aria-label="Tutorial resources"] button.resource-card',
    );
    const titles = await cards.locator("strong").allTextContents();
    for (const title of titles) {
      await cards.filter({ hasText: title }).first().click();
      const { score } = await detailStats(page);
      expect(
        Number(score),
        `${title} averages ${score}`,
      ).toBeGreaterThanOrEqual(4);
    }
  });
});

liteTest.describe("rating consistency (dashrate-lite)", () => {
  liteTest(
    "the distribution sums to the total for a resource with reviews",
    async ({ page }) => {
      liteTest.setTimeout(120_000);
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

liteTest.describe("top rated (dashrate-lite)", () => {
  liteTest(
    "the ranked average matches the resource's own average",
    async ({ page }) => {
      liteTest.setTimeout(120_000);
      await page.goto("/dashrate-lite.html");
      const items = page.locator("#leaderboard-result .rank-list li");
      await expect(items.first()).toBeVisible({ timeout: LOAD_TIMEOUT });

      const first = (await items.first().textContent()) ?? "";
      const match = /^(.*?)(\d+\.\d) avg$/.exec(first);
      expect(match, `unexpected row "${first}"`).not.toBeNull();
      const [, title, average] = match!;
      await page
        .locator('nav[aria-label="Tutorial resources"] button')
        .filter({ hasText: title })
        .click();
      await expect(
        page.locator("#aggregate-result .summary-grid .score .value"),
      ).toHaveText(average, { timeout: LOAD_TIMEOUT });
    },
  );
});
