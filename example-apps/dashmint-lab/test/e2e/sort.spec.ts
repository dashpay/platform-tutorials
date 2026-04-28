import { test, expect } from "./fixtures";

test("Collection sort button cycles labels (Rarity → Name → Owner → Price)", async ({
  page,
}) => {
  await page.getByRole("button", { name: "All" }).click();
  await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

  const sortBtn = page.getByRole("button", { name: /^sort:/i });
  await expect(sortBtn).toContainText(/rarity/i);
  await sortBtn.click();
  await expect(sortBtn).toContainText(/name/i);
  await sortBtn.click();
  await expect(sortBtn).toContainText(/owner/i);
  await sortBtn.click();
  await expect(sortBtn).toContainText(/price/i);
  await sortBtn.click();
  await expect(sortBtn).toContainText(/rarity/i);
});

test("Name sort renders cards alphabetically by title", async ({ page }) => {
  await page.getByRole("button", { name: "All" }).click();
  await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

  const titles = page.locator("article h3");
  if ((await titles.count()) < 2) {
    test.skip(true, "Need at least 2 cards in the contract to verify order.");
  }

  // Cycle sort to "Name" (default is "Rarity").
  const sortBtn = page.getByRole("button", { name: /^sort:/i });
  await sortBtn.click();
  await expect(sortBtn).toContainText(/name/i);

  const rendered = await titles.allTextContents();
  const expected = [...rendered].sort((a, b) => a.localeCompare(b));
  expect(rendered).toEqual(expected);
});
