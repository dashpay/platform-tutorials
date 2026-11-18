import type { Page } from "@playwright/test";
import {
  expect,
  LOAD_TIMEOUT,
  openContract,
  reviewCounts,
  test,
} from "./fixtures";

// Live, read-only invariants that hold for any data, each between two
// independent queries:
//  - "Most recent" is server-ordered newest first, and the proven rating
//    total equals the number of reviews listed once every page is loaded.
//  - The per-star histogram (grouped `count`) sums to the review count from
//    `average`.
//  - Each "Most rated" row's review count (batched `average`) matches the
//    count on the app's own page.
// Ratings are deletable, so each test skips without them. Discover's spec
// checks the 4★+ filter (`having`) and the Official only feed the same way.

function count(text: string | null) {
  const match = /(\d+)/.exec(text ?? "");
  return match ? Number(match[1]) : NaN;
}

async function ratingTotal(page: Page) {
  const total = page
    .getByRole("region", { name: "Ratings and reviews" })
    .locator(".rating-average small");
  await expect(total).toHaveText(/^(\d+ ratings?|No ratings yet)$/, {
    timeout: LOAD_TIMEOUT,
  });
  const text = await total.textContent();
  return text === "No ratings yet" ? 0 : count(text);
}

test("an app's reviews, histogram and rating total agree", async ({ page }) => {
  test.setTimeout(180_000);
  const [reviewed] = await reviewCounts();
  test.skip(!reviewed, "No ratings on the registry.");
  await openContract(page, reviewed![0]);
  const expected = await ratingTotal(page);
  expect(expected).toBeGreaterThan(0);

  const ratings = page.getByRole("region", { name: "Ratings and reviews" });
  const bars = ratings
    .getByRole("group", { name: "Ratings by star" })
    .getByRole("button");
  await expect(bars).toHaveCount(5);
  const labels = await bars.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("aria-label") ?? ""),
  );
  expect(
    labels.reduce(
      (sum, label) => sum + Number(/: (\d+)$/.exec(label)?.[1] ?? NaN),
      0,
    ),
  ).toBe(expected);

  // Load every page so the list can be compared with the total.
  const cards = ratings.locator("li.rating-card");
  await expect(cards.first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  const more = ratings.getByRole("button", { name: "Load more" });
  while (await more.isVisible()) {
    const before = await cards.count();
    await more.click();
    await expect
      .poll(() => cards.count(), { timeout: LOAD_TIMEOUT })
      .toBeGreaterThan(before);
  }
  const updated = await cards.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-updated-at") ?? ""),
  );
  expect(updated).toHaveLength(expected);
  for (let index = 1; index < updated.length; index++)
    expect(BigInt(updated[index])).toBeLessThanOrEqual(
      BigInt(updated[index - 1]),
    );
});

test("the leaderboard tabs switch, and each Most rated row matches its app", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const board = page.getByRole("region", { name: "Leaderboards" });
  const rows = board.locator("button.side-row");
  const showMostRated = async () => {
    await page.goto("/");
    await board.getByRole("button", { name: "Most rated" }).click();
    await expect(
      rows.first().or(board.getByText(/No reviews yet|unavailable/)),
    ).toBeVisible({ timeout: LOAD_TIMEOUT });
  };
  await showMostRated();
  const rowCount = await rows.count();
  test.skip(rowCount === 0, "No ratings on the registry.");
  const top = board.getByRole("button", { name: "Top rated" });
  await top.click();
  await expect(top).toHaveAttribute("aria-pressed", "true");
  await expect(rows.first()).toBeVisible();
  await board.getByRole("button", { name: "Most rated" }).click();
  for (let index = 0; index < rowCount; index++) {
    if (index > 0) await showMostRated();
    const row = rows.nth(index);
    const expected = count(
      await row.locator(".side-row-value small").textContent(),
    );
    expect(expected).toBeGreaterThan(0);
    await row.click();
    expect(await ratingTotal(page)).toBe(expected);
  }
});
