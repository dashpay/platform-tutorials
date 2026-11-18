import {
  connected,
  entryName,
  expect,
  expectNoHorizontalOverflow,
  gotoDiscover,
  LOAD_TIMEOUT,
  loadedListings,
  nav,
  test,
} from "./fixtures";

// Every control on Discover and the top navigation, read-only.

const DPNS_CONTRACT = "GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec";

test("the top navigation switches views and the brand returns home", async ({
  page,
}) => {
  await gotoDiscover(page);
  await expectNoHorizontalOverflow(page);
  await nav(page, "Search");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Search");
  await expectNoHorizontalOverflow(page);
  await nav(page, "Mine");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mine");
  await expect(page.getByText("Sign in to view your entries")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await nav(page, "Settings");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Settings");
  await expectNoHorizontalOverflow(page);
  await nav(page, "Discover");
  await expect(
    page.getByRole("heading", { name: "Built on Dash Platform" }),
  ).toBeVisible();

  await nav(page, "Settings");
  await page.getByRole("link", { name: "dashapps" }).click();
  await expect(
    page.getByRole("heading", { name: "Built on Dash Platform" }),
  ).toBeVisible();
  await expect(page.getByLabel("Network")).toHaveCount(0);
});

test("Retry connection recovers once the network is back", async ({ page }) => {
  const offline = (url: URL) => url.hostname !== "localhost";
  await page.route(offline, (route) => route.abort());
  await page.goto("/");
  const retry = page.getByRole("button", { name: "Retry connection" });
  await expect(retry).toBeVisible({ timeout: LOAD_TIMEOUT });
  await expect(page.getByText("Connection unavailable")).toBeAttached();
  await expect(
    page.locator(".header-account").getByRole("button", { name: "Sign in" }),
  ).toBeDisabled();

  await page.unroute(offline);
  await retry.click();
  await connected(page);
  await expect(retry).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.locator(".registry-panel article.registry-entry").first(),
  ).toBeVisible({ timeout: LOAD_TIMEOUT });
});

test("Discover never claims the registry is empty while it loads", async ({
  page,
}) => {
  test.fail(true, "The feed says 'No registry entries found.' before loading");
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.body?.innerText.includes("No registry entries found."))
        document.documentElement.dataset.sawEmpty = "true";
    }).observe(document, { childList: true, subtree: true });
  });
  await loadedListings(page);
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-saw-empty",
    "true",
  );
});

test("the featured hero opens details and the launch interstitial", async ({
  page,
}) => {
  await loadedListings(page);
  const hero = page.locator(".feature-primary");
  const name = (await hero.locator(".featured-title").textContent())!.trim();

  const launch = hero.getByRole("button", { name: "Launch ↗" });
  if (await launch.isVisible()) {
    await launch.click();
    const dialog = page.getByRole("dialog", {
      name: "Continue to another site?",
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: "Continue ↗" }),
    ).toHaveAttribute("target", "_blank");
    await expect(
      dialog.getByRole("link", { name: "Continue ↗" }),
    ).toHaveAttribute("href", /^https:\/\//);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    // The interstitial stops the click from opening the card behind it.
    await expect(
      page.getByRole("heading", { name: "Built on Dash Platform" }),
    ).toBeVisible();

    await launch.click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(dialog).toHaveCount(0);
  }

  await hero.getByRole("button", { name: "Details" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await page.getByRole("button", { name: "← Discover" }).click();
  await expect(hero).toBeVisible();

  await hero.click({ position: { x: 20, y: 20 } });
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
});

test("Also featured rows open by Details, click and keyboard", async ({
  page,
}) => {
  await loadedListings(page);
  const rows = page.locator(".feature-secondary .featured-row");
  test.skip((await rows.count()) === 0, "Only one listing to feature.");
  const row = rows.first();
  const name = (await row.locator("strong").textContent())!.trim();
  const heading = page.getByRole("heading", { level: 1, name });
  const back = page.getByRole("button", { name: "← Discover" });

  // Phones hide the Details pill; the whole row is the target there.
  const details = row.getByRole("button", { name: "Details" });
  if (await details.isVisible()) {
    await details.click();
    await expect(heading).toBeVisible({ timeout: LOAD_TIMEOUT });
    await back.click();
  }

  await row.locator("small").click();
  await expect(heading).toBeVisible({ timeout: LOAD_TIMEOUT });
  await back.click();

  await row.focus();
  await page.keyboard.press("Enter");
  await expect(heading).toBeVisible({ timeout: LOAD_TIMEOUT });
});

test("the Discover search box searches names and opens contract IDs", async ({
  page,
}) => {
  const entries = await loadedListings(page);
  const name = await entryName(entries.first());
  const box = page.getByLabel("Discover by keyword");
  const submit = page.getByRole("button", { name: "Search apps" });
  await expect(submit).toBeDisabled();

  await box.fill(name);
  await submit.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Search");
  await expect(page.getByLabel("Discover by keyword")).toHaveValue(name);
  const results = page.locator(".search-results");
  await expect(results.locator("p").first()).toHaveText(
    new RegExp(`\\d+ apps? · keyword “${name}”`),
    { timeout: LOAD_TIMEOUT },
  );
  await expect(
    results.getByRole("button", { name, exact: true }).first(),
  ).toBeVisible();

  await nav(page, "Discover");
  await page.getByLabel("Discover by keyword").fill(DPNS_CONTRACT);
  await page.getByRole("button", { name: "Search apps" }).click();
  await expect(page.locator(".detail-page")).toBeVisible();
  await expect(page.locator(".technical-details")).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await expect(page.getByRole("button", { name: "← Discover" })).toBeVisible();
});

test("category tiles expand, collapse and open a category", async ({
  page,
}) => {
  await loadedListings(page);
  const more = page.getByRole("button", { name: "More categories" });
  const tiles = page.locator(".category-tile");
  const compact = await tiles.count();
  expect(compact).toBeGreaterThan(0);
  expect(compact).toBeLessThanOrEqual(7);

  await more.click();
  const less = page.getByRole("button", { name: "Show less" });
  await expect(less).toHaveAttribute("aria-expanded", "true");
  await expect(tiles).toHaveCount(16);
  await less.click();
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await expect(tiles).toHaveCount(compact);
  await expectNoHorizontalOverflow(page);

  const label = (await tiles.first().textContent())!.trim();
  await tiles.first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
  await page.getByRole("button", { name: "← Discover" }).click();
  await expect(
    page.getByRole("heading", { name: "Built on Dash Platform" }),
  ).toBeVisible();
});

test("Launchable now cards open details, categories and the interstitial", async ({
  page,
}) => {
  await loadedListings(page);
  const cards = page.locator(".shelf-card");
  test.skip((await cards.count()) === 0, "No listing has an app URL.");
  const card = cards.first();
  const name = (await card.locator("strong").textContent())!.trim();

  await card.getByRole("button", { name: "Launch ↗" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Continue to another site?",
  });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(card).toBeVisible();

  const category = card.locator(".category-chip");
  const label = (await category.textContent())!.trim();
  await category.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
  await page.getByRole("button", { name: "← Discover" }).click();

  await page.locator(".shelf-card").first().locator("p").click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
});

test("Latest listings rows open by title, Details, row and category", async ({
  page,
}) => {
  const entries = await loadedListings(page);
  const entry = entries.first();
  const name = await entryName(entry);
  const heading = page.getByRole("heading", { level: 1, name });
  const back = page.getByRole("button", { name: "← Discover" });

  await entry.locator(".entry-title").click();
  await expect(heading).toBeVisible({ timeout: LOAD_TIMEOUT });
  await back.click();
  const details = entries.first().getByRole("button", { name: "Details" });
  if (await details.isVisible()) {
    await details.click();
    await expect(heading).toBeVisible({ timeout: LOAD_TIMEOUT });
    await back.click();
  }
  await entries.first().locator(".entry-copy p").click();
  await expect(heading).toBeVisible({ timeout: LOAD_TIMEOUT });
  await back.click();

  const category = entries.first().locator(".category-chip");
  const label = (await category.textContent())!.trim();
  await category.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
});

test("the All / Official only switch swaps the feed", async ({ page }) => {
  const entries = await loadedListings(page);
  const panel = page.locator(".registry-panel");
  const filter = panel.getByRole("group", { name: "Listing filter" });
  const all = filter.getByRole("button", { name: "All" });
  const official = filter.getByRole("button", { name: "Official only" });
  await expect(all).toHaveAttribute("aria-pressed", "true");

  await official.click();
  await expect(official).toHaveAttribute("aria-pressed", "true");
  await expect(all).toHaveAttribute("aria-pressed", "false");
  await expect(panel.locator(".panel-heading span")).toHaveText(
    "Chosen by contract owners · newest first",
  );
  await expect(
    entries
      .first()
      .or(panel.getByText(/No (contract owner|official listings)/)),
  ).toBeVisible({ timeout: LOAD_TIMEOUT });
  await expect(entries.locator(".entry-badge.community")).toHaveCount(0, {
    timeout: LOAD_TIMEOUT,
  });

  await all.click();
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await expect(panel.locator(".panel-heading span")).toHaveText("Newest first");
  await expect(entries.first()).toBeVisible({ timeout: LOAD_TIMEOUT });
});

test("the 4★+ chip filters the feed and clears again", async ({ page }) => {
  const entries = await loadedListings(page);
  const panel = page.locator(".registry-panel");
  const chip = panel.getByRole("button", { name: "4★+" });
  await expect(chip).toBeEnabled({ timeout: LOAD_TIMEOUT });
  const before = await entries.count();

  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(panel.locator(".feed-filters small")).toHaveText(
    new RegExp(`^\\d+ of ${before} loaded apps average 4★ or more$`),
  );
  const kept = await entries.count();
  expect(kept).toBeLessThanOrEqual(before);
  if (kept === 0)
    await expect(
      panel.getByText("No loaded app averages 4★ or more yet."),
    ).toBeVisible();

  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await expect(panel.locator(".feed-filters small")).toHaveCount(0);
  await expect(entries).toHaveCount(before);
});

test("Load more appends the next page of listings", async ({ page }) => {
  const entries = await loadedListings(page);
  const more = page
    .locator(".registry-panel")
    .getByRole("button", { name: "Load more" });
  test.skip(!(await more.isVisible()), "The registry fits on one page.");
  const before = await entries.count();
  await more.click();
  await expect
    .poll(() => entries.count(), { timeout: LOAD_TIMEOUT })
    .toBeGreaterThan(before);
});

test("the leaderboard tabs switch and their rows open the app", async ({
  page,
}) => {
  await gotoDiscover(page);
  const board = page.getByRole("region", { name: "Leaderboards" });
  const top = board.getByRole("button", { name: "Top rated" });
  const most = board.getByRole("button", { name: "Most rated" });
  const rows = board.locator("button.side-row");
  await expect(
    rows.first().or(board.getByText(/No reviews yet|unavailable/)),
  ).toBeVisible({ timeout: LOAD_TIMEOUT });
  await expect(top).toHaveAttribute("aria-pressed", "true");

  await most.click();
  await expect(most).toHaveAttribute("aria-pressed", "true");
  await expect(top).toHaveAttribute("aria-pressed", "false");
  test.skip((await rows.count()) === 0, "No reviews on the registry.");
  await top.click();
  await expect(top).toHaveAttribute("aria-pressed", "true");

  const row = rows.first();
  const name = (
    await row.locator(".side-row-title").evaluate((node) =>
      [...node.childNodes]
        .filter((child) => child.nodeType === Node.TEXT_NODE)
        .map((child) => child.textContent)
        .join(""),
    )
  ).trim();
  await row.click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
});

test("Add an app asks a guest to sign in", async ({ page }) => {
  test.fail(true, "A guest who adds an app reaches a page with no next step");
  await gotoDiscover(page);
  await page.locator(".describe-panel").getByRole("button").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Add an app",
  );
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "← Discover" }).click();
  await page
    .locator(".store-hero")
    .getByRole("button", { name: "Add an app" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Add an app",
  );

  await page.getByLabel("Open a contract").fill(DPNS_CONTRACT);
  const next = page.getByRole("button", { name: "Continue" });
  await expect(next).toBeEnabled({ timeout: LOAD_TIMEOUT });
  await next.click();
  await expect(page.locator(".technical-details")).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await expect(
    page
      .locator(".detail-page")
      .getByRole("button", { name: /^Sign in$|Add your entry/ }),
  ).toBeVisible({ timeout: 10_000 });
});

test("Popular tags list tags from the loaded listings", async ({ page }) => {
  await loadedListings(page);
  const tags = page.locator(".tag-panel .chip");
  await expect(
    page.getByRole("heading", { name: "Popular tags" }),
  ).toBeVisible();
  const count = await tags.count();
  expect(count).toBeLessThanOrEqual(6);
  for (const tag of await tags.allTextContents())
    expect(tag).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
});
