import { test, expect, rawTest, HAS_MNEMONIC, loginViaModal } from "./fixtures";

// ─── Browse-only sub-tabs ──────────────────────────────────────────────────

test("All tab loads and Marketplace filters by price", async ({ page }) => {
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

test("Yours sub-tab is hidden when not authenticated", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Yours" })).toHaveCount(0);
});

test("Mint tab shows the login overlay when not logged in", async ({
  page,
}) => {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /mint/i })
    .click();
  await expect(page.getByText(/login to burn dashmint tokens/i)).toBeVisible();
});

// ─── Card rendering ────────────────────────────────────────────────────────

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

test("at least one card on the default contract resolves to an @username owner", async ({
  page,
}) => {
  await page.getByRole("button", { name: "All" }).click();
  await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

  const cards = page.locator("article");
  if ((await cards.count()) === 0) {
    test.skip(true, "No cards on the default contract.");
  }

  // useDpnsName fills the owner chip with `@<name>` once it resolves; the
  // truncated-id fallback is hex characters and never starts with `@`.
  const namedOwnerChip = page.locator("article a", { hasText: /^@\w/ });
  await expect(namedOwnerChip.first()).toBeVisible({ timeout: 15_000 });
});

// ─── Sort ──────────────────────────────────────────────────────────────────

test("sort button cycles labels (Rarity → Name → Owner → Price)", async ({
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
    test.skip(true, "Need at least 2 cards to verify order.");
  }

  const sortBtn = page.getByRole("button", { name: /^sort:/i });
  await sortBtn.click();
  await expect(sortBtn).toContainText(/name/i);

  const rendered = await titles.allTextContents();
  const expected = [...rendered].sort((a, b) => a.localeCompare(b));
  expect(rendered).toEqual(expected);
});

test("Rarity sort orders cards by descending atk + def total", async ({
  page,
}) => {
  await page.getByRole("button", { name: "All" }).click();
  await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

  const cards = page.locator("article");
  const count = await cards.count();
  if (count < 2) {
    test.skip(true, "Need at least 2 cards to verify rarity ordering.");
  }

  const inspect = Math.min(count, 8);
  const totals: number[] = [];
  for (let i = 0; i < inspect; i += 1) {
    const text = await cards.nth(i).innerText();
    const match = text.match(/ATK\s*(\d+)[\s\S]*?DEF\s*(\d+)/);
    if (!match) {
      throw new Error(`Could not parse ATK/DEF for card ${i}: ${text}`);
    }
    totals.push(Number(match[1]) + Number(match[2]));
  }

  for (let i = 1; i < totals.length; i += 1) {
    expect(totals[i]).toBeLessThanOrEqual(totals[i - 1]);
  }
});

test("Owner sort orders cards lexicographically by owner identity id", async ({
  page,
}) => {
  await page.getByRole("button", { name: "All" }).click();
  await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

  const cards = page.locator("article");
  const count = await cards.count();
  if (count < 2) {
    test.skip(true, "Need at least 2 cards to verify owner ordering.");
  }

  const sortBtn = page.getByRole("button", { name: /^sort:/i });
  await sortBtn.click(); // Rarity → Name
  await sortBtn.click(); // Name → Owner
  await expect(sortBtn).toContainText(/owner/i);

  const inspect = Math.min(count, 8);
  const owners: string[] = [];
  for (let i = 0; i < inspect; i += 1) {
    const href = await cards
      .nth(i)
      .locator('a[href*="/identity/"]')
      .first()
      .getAttribute("href");
    owners.push(href?.split("/identity/")[1] ?? "");
  }

  if (new Set(owners).size < 2) {
    test.skip(true, "All inspected cards share the same owner; cannot verify.");
  }

  expect(owners).toEqual([...owners].sort());
});

test("Price sort puts the highest-priced card first in the Marketplace", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Marketplace" }).click();
  await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

  const cards = page.locator("article");
  const count = await cards.count();
  if (count < 2) {
    test.skip(true, "Need at least 2 priced cards in the marketplace.");
  }

  const sortBtn = page.getByRole("button", { name: /^sort:/i });
  await sortBtn.click();
  await sortBtn.click();
  await sortBtn.click();
  await expect(sortBtn).toContainText(/price/i);

  const inspect = Math.min(count, 8);
  const prices: number[] = [];
  for (let i = 0; i < inspect; i += 1) {
    const text = await cards.nth(i).innerText();
    const match = text.match(/([\d,]+)\s*cr/);
    if (!match) {
      throw new Error(`Could not parse price chip for card ${i}: ${text}`);
    }
    prices.push(Number(match[1].replace(/,/g, "")));
  }

  for (let i = 1; i < prices.length; i += 1) {
    expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
  }
});

// ─── App resilience / chrome ───────────────────────────────────────────────

// `bogus-contract` and `mobile-drawer` deliberately bypass the shared `page`
// fixture's "Connected" wait so they can manipulate localStorage / viewport
// before the first navigation.
rawTest(
  "App stays usable when localStorage holds a bogus contract id",
  async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("dashmint-lab.contractId", "0".repeat(44));
    });
    await page.goto("/");

    await expect(
      page.getByRole("navigation").getByRole("button", { name: /collection/i }),
    ).toBeVisible({ timeout: 60_000 });

    await page.getByRole("button", { name: "All" }).click();
    await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

    const articles = page.locator("article");
    const empty = page.getByText(/no cards found/i);
    await expect(articles.first().or(empty)).toBeVisible();
  },
);

rawTest.describe("Mobile viewport", () => {
  rawTest.use({ viewport: { width: 390, height: 844 } });

  rawTest("hamburger toggles the navigation drawer", async ({ page }) => {
    await page.goto("/");

    const hamburger = page.getByRole("button", { name: /open menu/i });
    await expect(hamburger).toBeVisible();

    const collectionNavBtn = page
      .getByRole("navigation")
      .getByRole("button", { name: /collection/i });

    await hamburger.click();
    await expect(collectionNavBtn).toBeInViewport();

    // Click outside the drawer to close.
    await page.mouse.click(380, 10);
    await expect(collectionNavBtn).not.toBeInViewport();
  });

  rawTest("login flow works under a mobile viewport", async ({ page }) => {
    rawTest.skip(!HAS_MNEMONIC, "PLATFORM_MNEMONIC not set");
    await page.goto("/");
    await expect(page.getByText("Connected").first()).toBeVisible({
      timeout: 60_000,
    });

    // The sidebar nav (and its Login button) is hidden behind the hamburger
    // on mobile. Open the drawer first so loginViaModal can find the button.
    await page.getByRole("button", { name: /open menu/i }).click();
    await loginViaModal(page);

    // Dismiss the drawer (it stays open after login on this viewport).
    await page.keyboard.press("Escape");

    // Yours sub-tab is now reachable from the in-page tab row.
    await expect(page.getByRole("button", { name: "Yours" })).toBeVisible();
  });
});
