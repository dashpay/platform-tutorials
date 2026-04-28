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
