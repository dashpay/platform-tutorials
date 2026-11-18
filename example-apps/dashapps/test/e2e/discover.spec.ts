import {
  expectApp,
  DPNS_CONTRACT,
  entryName,
  expect,
  expectNoHorizontalOverflow,
  gotoDiscover,
  LOAD_TIMEOUT,
  loadedListings,
  test,
} from "./fixtures";

// Every control on Discover, read-only.

const EMPTY_MESSAGES = [
  "No registry entries found.",
  "No reviews yet.",
  "No contract owner has marked a listing official yet.",
];

test("the feed filters never claim it is empty while loading", async ({
  page,
}) => {
  // Records every empty message shown, however briefly.
  await page.addInitScript((messages) => {
    new MutationObserver(() => {
      const text = document.body?.innerText ?? "";
      const seen = new Set(document.documentElement.dataset.seen?.split("|"));
      for (const message of messages)
        if (text.includes(message)) seen.add(message);
      document.documentElement.dataset.seen = [...seen].join("|");
    }).observe(document, { childList: true, subtree: true });
  }, EMPTY_MESSAGES);
  const seen = async () =>
    (await page.locator("html").getAttribute("data-seen"))?.split("|") ?? [];
  const entries = await loadedListings(page);
  const panel = page.locator(".registry-panel");
  const board = page.getByRole("region", { name: "Leaderboards" });
  await expect(
    board.locator("button.side-row").first().or(board.getByText(/^No /)),
  ).toBeVisible({ timeout: LOAD_TIMEOUT });
  expect(await seen()).not.toContain(EMPTY_MESSAGES[0]);
  if (await board.locator("button.side-row").count())
    expect(await seen()).not.toContain(EMPTY_MESSAGES[1]);

  await test.step("4★+ keeps only apps averaging 4 or more", async () => {
    const chip = panel.getByRole("button", { name: "4★+" });
    await expect(chip).toBeEnabled({ timeout: LOAD_TIMEOUT });
    const before = await entries.count();
    await chip.click();
    await expect(panel.locator(".feed-filters small")).toHaveText(
      new RegExp(`^\\d+ of ${before} loaded apps average 4★ or more$`),
    );
    for (const rating of await entries.locator(".entry-rating").all()) {
      await expect(rating).toHaveText(/★ \d\.\d/, { timeout: LOAD_TIMEOUT });
      const [, average] = /★ (\d\.\d)/.exec((await rating.textContent())!)!;
      expect(Number(average)).toBeGreaterThanOrEqual(4);
    }
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await expect(entries).toHaveCount(before);
  });

  const more = panel.getByRole("button", { name: "Load more" });
  if (await more.isVisible()) {
    const before = await entries.count();
    await more.click();
    await expect
      .poll(() => entries.count(), { timeout: LOAD_TIMEOUT })
      .toBeGreaterThan(before);
  }
  for (const tag of await page.locator(".tag-panel .chip").allTextContents())
    expect(tag).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);

  await test.step("Official only lists endorsed apps", async () => {
    const filter = panel.getByRole("group", { name: "Listing filter" });
    await filter.getByRole("button", { name: "Official only" }).click();
    await expect(panel.locator(".panel-heading span")).toHaveText(
      "Chosen by contract owners · newest first",
    );
    await expect(
      entries.first().or(panel.getByText(/No (contract owner|official)/)),
    ).toBeVisible({ timeout: LOAD_TIMEOUT });
    if (!(await entries.count())) return;
    expect(await seen()).not.toContain(EMPTY_MESSAGES[2]);
    // The badge comes from a separate lookup of each contract's endorsement.
    await expect(entries.locator(".entry-badge.community")).toHaveCount(0);
    const first = entries.first();
    await expect(first.locator(".entry-badge.official")).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });
    const name = await entryName(first);
    await first.locator(".entry-title").click();
    await expectApp(page, name);
    await expect(
      page.getByText("Official listing, chosen by the contract owner"),
    ).toBeVisible({ timeout: LOAD_TIMEOUT });
  });
});

test("featured and launchable apps open by click, keyboard and Launch", async ({
  page,
}) => {
  await loadedListings(page);
  const back = page.getByRole("button", { name: "← Discover" });
  const hero = page.locator(".feature-primary");
  const name = (await hero.locator(".featured-title").textContent())!.trim();
  const interstitial = page.getByRole("dialog", {
    name: "Continue to another site?",
  });

  const launch = hero.getByRole("button", { name: "Launch ↗" });
  if (await launch.isVisible()) {
    await launch.click();
    await expect(
      interstitial.getByRole("link", { name: "Continue ↗" }),
    ).toHaveAttribute("href", /^https:\/\//);
    await page.mouse.click(5, 5);
    await expect(interstitial).toHaveCount(0);
    // Closing it doesn't open the card behind it.
    await expect(hero).toBeVisible();
  }
  await hero.getByRole("button", { name: "Details" }).click();
  await expectApp(page, name);
  await back.click();
  await hero.click({ position: { x: 20, y: 20 } });
  await expectApp(page, name);
  await back.click();

  const row = page.locator(".feature-secondary .featured-row").first();
  if (await row.isVisible()) {
    const other = (await row.locator("strong").textContent())!.trim();
    // Phones hide the Details pill; the whole row is the target there.
    const details = row.getByRole("button", { name: "Details" });
    if (await details.isVisible()) {
      await details.click();
      await expectApp(page, other);
      await back.click();
    }
    await row.focus();
    await page.keyboard.press("Enter");
    await expectApp(page, other);
    await back.click();
  }

  const card = page.locator(".shelf-card").first();
  if (await card.isVisible()) {
    const launchable = (await card.locator("strong").textContent())!.trim();
    await card.getByRole("button", { name: "Launch ↗" }).click();
    await page.keyboard.press("Escape");
    await expect(interstitial).toHaveCount(0);
    await card.locator("p").click();
    await expectApp(page, launchable);
  }
});

test("Latest listings rows open by title, Details, row, keyboard and category", async ({
  page,
}) => {
  const entries = await loadedListings(page);
  const name = await entryName(entries.first());
  const back = page.getByRole("button", { name: "← Discover" });

  await entries.first().locator(".entry-title").click();
  await expectApp(page, name);
  await back.click();
  const details = entries.first().getByRole("button", { name: "Details" });
  if (await details.isVisible()) {
    await details.click();
    await expectApp(page, name);
    await back.click();
  }
  await entries.first().locator(".entry-copy p").click();
  await expectApp(page, name);
  await back.click();

  const title = entries.first().locator(".entry-title");
  await title.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(title).toBeFocused();
  await page.keyboard.press("Enter");
  await expectApp(page, name);
  await back.click();

  const category = entries.first().locator(".category-chip");
  const label = (await category.textContent())!.trim();
  await category.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
});

test("Add an app asks a guest to sign in and links back to itself", async ({
  page,
}) => {
  await gotoDiscover(page);
  const heading = page.getByRole("heading", { level: 1 });
  await page.locator(".describe-panel").getByRole("button").click();
  await expect(heading).toHaveText("Add an app");
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "← Discover" }).click();
  await page
    .locator(".store-hero")
    .getByRole("button", { name: "Add an app" })
    .click();
  await expect(heading).toHaveText("Add an app");

  await page.getByLabel("Open a contract").fill(DPNS_CONTRACT);
  const next = page.getByRole("button", { name: "Continue" });
  await expect(next).toBeEnabled({ timeout: LOAD_TIMEOUT });
  await next.click();
  await expect(page.locator(".technical-details")).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  const prompt = page.locator(".detail-page .signed-out-card");
  await expect(prompt).toContainText("Sign in to add your entry");
  await prompt.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("dialog", { name: "Sign in to dashapps" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "← Add an app" }).click();
  await expect(heading).toHaveText("Add an app");
});
