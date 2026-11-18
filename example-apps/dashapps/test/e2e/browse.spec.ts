import type { Page } from "@playwright/test";
import {
  connected,
  entryName,
  listedName,
  expect,
  expectNoHorizontalOverflow,
  gotoDiscover,
  LOAD_TIMEOUT,
  loadedListings,
  nav,
  test,
} from "./fixtures";

// The Search and category views, read-only.

const DPNS_CONTRACT = "GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec";
// A valid identifier that no contract uses.
const UNKNOWN_CONTRACT = "11111111111111111111111111111111";

function searchBox(page: Page) {
  return {
    input: page.getByLabel("Discover by keyword"),
    submit: page.locator("form.store-search button"),
    summary: page.locator(".search-results > p").first(),
  };
}

test("a keyword search lists registry matches that open with a way back", async ({
  page,
}) => {
  const entries = await loadedListings(page);
  const name = await entryName(entries.first());
  await nav(page, "Search");
  const search = searchBox(page);
  await expect(search.submit).toBeDisabled();
  await search.input.fill(name);
  await search.submit.click();
  await expect(search.summary).toHaveText(
    new RegExp(`^\\d+ apps? · keyword “${name}”$`),
    { timeout: LOAD_TIMEOUT },
  );
  const results = page.locator(".search-results article.registry-entry");
  const match = results.filter({ hasText: name }).first();
  await match.getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await page.getByRole("button", { name: "← Search" }).click();
  await expect(search.summary).toBeVisible();

  await match.getByRole("button", { name, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await expectNoHorizontalOverflow(page);
});

test("Search finds a listed app before Discover's feed has loaded", async ({
  page,
}) => {
  test.fail(true, "Search only matches listings Discover has already loaded");
  const name = await listedName();
  test.skip(!name, "No listings on the registry.");
  // Hold document queries so the feed is still loading when Search opens.
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
  const search = searchBox(page);
  await search.input.fill(name!);
  await search.submit.click();
  await expect(search.summary).toHaveText(/keyword/, { timeout: 15_000 });
  await expect(
    page.locator(".search-results").getByRole("button", { name }),
  ).toBeVisible();
});

test("Search clicked while the app connects still runs", async ({ page }) => {
  test.fail(true, "Search is enabled before the SDK connects and does nothing");
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
  await expect(search.submit).toBeEnabled();
  await search.submit.click();
  release();
  await connected(page);
  await expect(search.summary).toBeVisible({ timeout: 15_000 });
});

test("keyword searches report no results and short keywords", async ({
  page,
}) => {
  await gotoDiscover(page);
  await nav(page, "Search");
  const search = searchBox(page);
  await search.input.fill("zzqxnosuchkeyword");
  await expect(search.submit).toBeEnabled({ timeout: LOAD_TIMEOUT });
  await search.submit.click();
  await expect(page.getByText("No apps found for this keyword.")).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await expect(search.summary).toHaveText(
    "0 apps · keyword “zzqxnosuchkeyword”",
  );

  await search.input.fill("ab");
  await search.submit.click();
  await expect(page.getByRole("alert")).toHaveText(
    /Use a keyword of 3–50 characters\./,
    { timeout: LOAD_TIMEOUT },
  );
});

test("a too-short keyword is not reported as having no results", async ({
  page,
}) => {
  test.fail(true, "A rejected keyword also shows '0 apps' and 'No apps found'");
  await gotoDiscover(page);
  await nav(page, "Search");
  const search = searchBox(page);
  await search.input.fill("ab");
  await expect(search.submit).toBeEnabled({ timeout: LOAD_TIMEOUT });
  await search.submit.click();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: LOAD_TIMEOUT });
  await expect(page.getByText("No apps found for this keyword.")).toHaveCount(
    0,
  );
});

test("Show more pages keyword results", async ({ page }) => {
  await gotoDiscover(page);
  await nav(page, "Search");
  const search = searchBox(page);
  await search.input.fill("dash");
  await expect(search.submit).toBeEnabled({ timeout: LOAD_TIMEOUT });
  await search.submit.click();
  await expect(search.summary).toBeVisible({ timeout: LOAD_TIMEOUT });
  await expect(search.submit).toHaveText("Search", { timeout: LOAD_TIMEOUT });
  const more = page.getByRole("button", { name: "Show more" });
  test.skip(!(await more.isVisible()), "One page of keyword results.");
  const rows = page.locator(".search-results article");
  const before = await rows.count();
  await more.click();
  await expect
    .poll(() => rows.count(), { timeout: LOAD_TIMEOUT })
    .toBeGreaterThan(before);
});

test("opening a contract by ID handles valid, invalid and unknown IDs", async ({
  page,
}) => {
  await gotoDiscover(page);
  await nav(page, "Search");
  const input = page.getByLabel("Open a contract");
  const open = page.locator(".contract-tools").getByRole("button", {
    name: "Open",
  });
  await expect(open).toBeEnabled({ timeout: LOAD_TIMEOUT });

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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Search");

  await input.fill(DPNS_CONTRACT);
  await open.click();
  await expect(page.locator(".technical-details")).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".contract-copy")).toHaveAttribute(
    "title",
    DPNS_CONTRACT,
  );
});

test("a category page filters, pages and opens its listings", async ({
  page,
}) => {
  const entries = await loadedListings(page);
  const chip = entries.first().locator(".category-chip");
  const label = (await chip.textContent())!.trim();
  await chip.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
  const listings = page.locator(".category-page article.registry-entry");
  await expect(listings.first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  await expect(page.locator(".category-count")).toHaveText(
    /^\d+\+? apps? in this category$/,
  );
  await expectNoHorizontalOverflow(page);

  const filters = page.getByLabel("Category filter");
  const all = filters.getByRole("button", { name: "All" });
  const launchable = filters.getByRole("button", { name: "Launchable" });
  const official = filters.getByRole("button", { name: "Official" });
  await expect(all).toHaveAttribute("aria-pressed", "true");
  const total = await listings.count();

  await launchable.click();
  await expect(launchable).toHaveAttribute("aria-pressed", "true");
  for (const listing of await listings.all())
    await expect(
      listing.getByRole("button", { name: "Launch ↗" }),
    ).toBeVisible();
  await official.click();
  await expect(official).toHaveAttribute("aria-pressed", "true");
  for (const listing of await listings.all())
    await expect(listing.locator(".entry-badge.official")).toBeVisible();
  await all.click();
  await expect(listings).toHaveCount(total);

  const more = page.getByRole("button", { name: "Load more" });
  if (await more.isVisible()) {
    await more.click();
    await expect
      .poll(() => listings.count(), { timeout: LOAD_TIMEOUT })
      .toBeGreaterThan(total);
  }

  const name = await entryName(listings.first());
  await listings.first().locator(".entry-copy p").click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await page.locator(".detail-page .back-link").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
  await page.getByRole("button", { name: "← Discover" }).click();
  await expect(
    page.getByRole("heading", { name: "Built on Dash Platform" }),
  ).toBeVisible();
});

test("a detail page's back link goes where it says", async ({ page }) => {
  test.fail(true, "From a category, '← Discover' returns to the category");
  const entries = await loadedListings(page);
  const chip = entries.first().locator(".category-chip");
  const label = (await chip.textContent())!.trim();
  await chip.click();
  const listings = page.locator(".category-page article.registry-entry");
  await listings.first().locator(".entry-title").click();
  const back = page.locator(".detail-page .back-link");
  await expect(back).toBeVisible();
  const promised = (await back.textContent())!.replace("← ", "");
  await back.click();
  await expect(
    promised === "Discover"
      ? page.getByRole("heading", { name: "Built on Dash Platform" })
      : page.getByRole("heading", { level: 1, name: label }),
  ).toBeVisible();
});

test("a category's sign-in card opens and cancels the sign-in form", async ({
  page,
}) => {
  await gotoDiscover(page);
  await page.locator(".category-tile").first().click();
  const card = page.locator(".category-signin");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Sign in" }).click();
  const dialog = page.getByRole("dialog", { name: "Sign in to dashapps" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(card).toBeVisible();
});
