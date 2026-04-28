import { test, expect } from "./fixtures";

test("CardTile owner chip links to the platform explorer", async ({ page }) => {
  await page.getByRole("button", { name: "All" }).click();
  await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

  const cards = page.locator("article");
  if ((await cards.count()) === 0) {
    test.skip(true, "No cards on the default contract; nothing to inspect.");
  }

  const firstCard = cards.first();
  const ownerLink = firstCard.locator(
    'a[href^="https://testnet.platform-explorer.com/identity/"]',
  );
  await expect(ownerLink.first()).toBeVisible();
});

test("CardTile overflow menu shows Copy ID and View on Explorer", async ({
  page,
}) => {
  await page.getByRole("button", { name: "All" }).click();
  await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

  const cards = page.locator("article");
  if ((await cards.count()) === 0) {
    test.skip(true, "No cards on the default contract; nothing to inspect.");
  }

  const firstCard = cards.first();
  await firstCard.getByRole("button", { name: /more actions/i }).click();
  await expect(firstCard.getByRole("button", { name: /copy id/i })).toBeVisible();
  await expect(
    firstCard.getByRole("button", { name: /view on explorer/i }),
  ).toBeVisible();
});
