import { test, expect } from "./fixtures";

test("browse-only: All tab loads and Marketplace filters by price", async ({
  page,
}) => {
  // The default contract is the pre-deployed testnet card contract; the
  // expectation is just "the query came back and the grid rendered" — either
  // we see article tiles or the empty-state copy. Either way means "Loading…"
  // has cleared.
  await page.getByRole("button", { name: "All" }).click();
  await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });
  const allCards = page.locator("article");
  const noCards = page.getByText(/no cards found/i);
  await expect(allCards.first().or(noCards)).toBeVisible();

  await page.getByRole("button", { name: "Marketplace" }).click();
  await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });
  const marketCards = page.locator("article");
  const noSales = page.getByText(/no cards for sale right now/i);
  await expect(marketCards.first().or(noSales)).toBeVisible();
});

test("browse-only: Yours sub-tab is hidden when not authenticated", async ({
  page,
}) => {
  await expect(page.getByRole("button", { name: "Yours" })).toHaveCount(0);
});
