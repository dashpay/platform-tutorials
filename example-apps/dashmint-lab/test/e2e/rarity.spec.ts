import { test, expect } from "./fixtures";

test("rendered cards always carry a rarity tag (common/rare/legendary)", async ({
  page,
}) => {
  await page.getByRole("button", { name: "All" }).click();
  await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

  const grid = page.locator("article");
  const empty = page.getByText(/no cards found/i);
  await expect(grid.first().or(empty)).toBeVisible();

  if (await empty.isVisible().catch(() => false)) {
    test.skip(true, "No cards in default contract; nothing to assert.");
  }

  const count = await grid.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < Math.min(count, 5); i += 1) {
    await expect(grid.nth(i)).toContainText(/common|rare|legendary/i);
  }
});
