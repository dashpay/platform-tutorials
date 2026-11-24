import type { Page } from "@playwright/test";
import {
  expectApp,
  connected,
  DPNS_CONTRACT,
  entryName,
  expect,
  expectNoHorizontalOverflow,
  LOAD_TIMEOUT,
  listedName,
  loadedListings,
  nav,
  test,
} from "./fixtures";

// The Search and category views, read-only.

// A valid identifier that no contract uses.
const UNKNOWN_CONTRACT = "11111111111111111111111111111111";

function searchBox(page: Page) {
  return {
    input: page.getByLabel("Discover by keyword"),
    submit: page.locator("form.store-search button"),
    summary: page.locator(".search-results > p").first(),
  };
}

test("Search stays disabled until the app connects", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/setupDashClient-core|evo-sdk/, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/");
  await nav(page, "Search");
  const search = searchBox(page);
  await search.input.fill("zzqxnosuchkeyword");
  await expect(search.submit).toBeDisabled();
  release();
  await connected(page);
  await expect(search.submit).toBeEnabled();
  await search.submit.click();
  await expect(page.getByText("No apps found for this keyword.")).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await expect(search.summary).toHaveText(
    "0 apps · keyword “zzqxnosuchkeyword”",
  );

  await test.step("a short term searches names; a long one only errors", async () => {
    await search.input.fill("zq");
    await search.submit.click();
    await expect(search.summary).toHaveText("0 apps · keyword “zq”", {
      timeout: LOAD_TIMEOUT,
    });
    await expect(page.getByRole("alert")).toHaveCount(0);
    await search.input.fill("z".repeat(64));
    await search.submit.click();
    await expect(page.getByRole("alert")).toHaveText(
      /Use 3–50 characters for a keyword, or up to 63 for a name\./,
    );
    await expect(page.locator(".search-results")).toHaveCount(0);
  });
});

test("Search finds a listed app on a fresh load and links back", async ({
  page,
}) => {
  const name = await listedName();
  test.skip(!name, "No listings on the registry.");
  // Hold document queries so Discover's feed never loads before Search.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/getDocuments$/, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/");
  await connected(page);
  await nav(page, "Search");
  release();
  await expect(page.getByText(/Name matches are case-sensitive/)).toBeVisible();
  const search = searchBox(page);
  await search.input.fill(name!);
  await search.submit.click();
  await expect(search.summary).toHaveText(
    new RegExp(
      `^\\d+ apps? · keyword “${name!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}”$`,
    ),
    { timeout: LOAD_TIMEOUT },
  );
  const match = page
    .locator(".search-results article.registry-entry")
    .filter({ hasText: name })
    .first();
  await match.getByRole("button", { name: "Open" }).click();
  await expectApp(page, name!);
  await page.getByRole("button", { name: "← Search" }).click();
  await match.getByRole("button", { name, exact: true }).click();
  await expectApp(page, name!);
  await expectNoHorizontalOverflow(page);
});

test("contracts open by ID from Search and the Discover box", async ({
  page,
}) => {
  const entries = await loadedListings(page);
  const name = await entryName(entries.first());
  const search = searchBox(page);
  await expect(search.submit).toBeDisabled();
  await search.input.fill(name);
  await search.submit.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Search");
  await expect(search.input).toHaveValue(name);

  const input = page.getByLabel("Open a contract");
  const open = page.locator(".contract-tools").getByRole("button");
  await input.fill("not-an-id");
  await open.click();
  await expect(page.getByRole("alert")).toHaveText(
    /valid 32-byte Platform identifier/,
  );
  await input.fill(UNKNOWN_CONTRACT);
  await open.click();
  await expect(
    page.getByText("Contract not found on this network."),
  ).toBeVisible({ timeout: LOAD_TIMEOUT });
  await page.getByRole("button", { name: "← Search" }).click();

  await nav(page, "Discover");
  await search.input.fill(DPNS_CONTRACT);
  await search.submit.click();
  await expect(page.locator(".technical-details")).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".contract-copy")).toHaveAttribute(
    "title",
    DPNS_CONTRACT,
  );
  await page.getByRole("button", { name: "← Discover" }).click();
  await expect(
    page.getByRole("heading", { name: "Built on Dash Platform" }),
  ).toBeVisible();
});

test("categories expand, filter, page and link back where they say", async ({
  page,
}) => {
  const entries = await loadedListings(page);
  const heading = page.getByRole("heading", { level: 1 });

  await test.step("category tiles", async () => {
    const tiles = page.locator(".category-tile");
    const compact = await tiles.count();
    expect(compact).toBeGreaterThan(0);
    expect(compact).toBeLessThanOrEqual(7);
    await page.getByRole("button", { name: "More categories" }).click();
    await expect(tiles).toHaveCount(16);
    await page.getByRole("button", { name: "Show less" }).click();
    await expect(tiles).toHaveCount(compact);
  });

  const label = (await entries
    .first()
    .locator(".category-chip")
    .textContent())!.trim();
  await entries.first().locator(".category-chip").click();
  await expect(heading).toHaveText(label);
  const listings = page.locator(".category-page article.registry-entry");
  await expect(listings.first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  await expect(page.locator(".category-count")).toHaveText(
    /^\d+\+? apps? in this category$/,
  );
  await expectNoHorizontalOverflow(page);

  await test.step("filters and Load more", async () => {
    const filters = page.getByLabel("Category filter");
    const all = filters.getByRole("button", { name: "All" });
    const total = await listings.count();
    await filters.getByRole("button", { name: "Launchable" }).click();
    for (const listing of await listings.all())
      await expect(
        listing.getByRole("button", { name: "Launch ↗" }),
      ).toBeVisible();
    await filters.getByRole("button", { name: "Official" }).click();
    for (const listing of await listings.all())
      await expect(listing.locator(".entry-badge.official")).toBeVisible();
    await all.click();
    await expect(all).toHaveAttribute("aria-pressed", "true");
    await expect(listings).toHaveCount(total);
    const more = page.getByRole("button", { name: "Load more" });
    if (await more.isVisible()) {
      await more.click();
      await expect
        .poll(() => listings.count(), { timeout: LOAD_TIMEOUT })
        .toBeGreaterThan(total);
    }
  });

  await test.step("the sign-in card", async () => {
    const card = page.locator(".category-signin");
    await card.getByRole("button", { name: "Sign in" }).click();
    const dialog = page.getByRole("dialog", { name: "Sign in to dashapps" });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(card).toBeVisible();
  });

  const name = await entryName(listings.first());
  await listings.first().locator(".entry-copy p").click();
  await expectApp(page, name);
  await page.getByRole("button", { name: `← ${label}` }).click();
  await expect(heading).toHaveText(label);
  await page.getByRole("button", { name: "← Discover" }).click();
  await expect(
    page.getByRole("heading", { name: "Built on Dash Platform" }),
  ).toBeVisible();
});
