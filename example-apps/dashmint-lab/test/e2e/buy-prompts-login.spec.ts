import { test, expect } from "./fixtures";

test("Marketplace Buy button opens LoginModal when not authenticated", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Marketplace" }).click();
  await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

  const cards = page.locator("article");
  if ((await cards.count()) === 0) {
    test.skip(true, "Marketplace is empty on testnet; nothing to buy.");
  }

  // The browse-only Buy button is the outlined variant — same accessible name.
  await cards.first().getByRole("button", { name: /^buy$/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByPlaceholder("mnemonic phrase"),
  ).toBeVisible();
});
