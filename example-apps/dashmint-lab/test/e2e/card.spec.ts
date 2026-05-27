import { test, expect } from "./fixtures";

test("CardTile owner chip links to the platform explorer", async ({ page }) => {
  await page.getByRole("button", { name: "All" }).click();
  await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

  const cards = page.locator("article");
  if ((await cards.count()) === 0) {
    test.skip(true, "No cards on the default contract; nothing to inspect.");
  }

  const ownerLink = cards
    .first()
    .locator('a[href^="https://testnet.platform-explorer.com/identity/"]');
  await expect(ownerLink.first()).toBeVisible();
});

test("CardTile overflow menu shows Copy ID and View on Explorer", async ({
  page,
}) => {
  await page.getByRole("button", { name: "All" }).click();
  await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

  const cards = page.locator("article");
  if ((await cards.count()) === 0) {
    test.skip(true, "No cards on the default contract.");
  }

  const firstCard = cards.first();
  await firstCard.getByRole("button", { name: /more actions/i }).click();
  await expect(
    firstCard.getByRole("button", { name: /copy id/i }),
  ).toBeVisible();
  await expect(
    firstCard.getByRole("button", { name: /view on explorer/i }),
  ).toBeVisible();
});

test("View on Explorer opens a Platform Explorer popup", async ({ page }) => {
  await page.getByRole("button", { name: "All" }).click();
  await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

  const cards = page.locator("article");
  if ((await cards.count()) === 0) {
    test.skip(true, "No cards on the default contract.");
  }

  const firstCard = cards.first();
  await firstCard.getByRole("button", { name: /more actions/i }).click();

  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    firstCard.getByRole("button", { name: /view on explorer/i }).click(),
  ]);

  expect(popup.url()).toMatch(
    /^https:\/\/testnet\.platform-explorer\.com\/document\//,
  );
  await popup.close();
});

test("Copy ID writes a 44-char document id to the clipboard", async ({
  page,
}) => {
  await page.getByRole("button", { name: "All" }).click();
  await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

  const cards = page.locator("article");
  if ((await cards.count()) === 0) {
    test.skip(true, "No cards on the default contract.");
  }

  const firstCard = cards.first();
  await firstCard.getByRole("button", { name: /more actions/i }).click();
  await firstCard.getByRole("button", { name: /copy id/i }).click();

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  // Platform document IDs are 32-byte base58 — 43 or 44 chars depending on the
  // leading byte (a 32-byte value encodes to 43.7 base58 chars on average).
  expect(copied).toMatch(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/);
});

test("Marketplace Buy button opens LoginModal when not authenticated", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Marketplace" }).click();
  await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

  const cards = page.locator("article");
  if ((await cards.count()) === 0) {
    test.skip(true, "Marketplace is empty on testnet; nothing to buy.");
  }

  await cards.first().getByRole("button", { name: /^buy$/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByPlaceholder("mnemonic phrase"),
  ).toBeVisible();
});
