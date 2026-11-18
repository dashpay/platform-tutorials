import type { Page } from "@playwright/test";
import {
  contractWithListings,
  detailLoaded,
  expect,
  expectNoHorizontalOverflow,
  LOAD_TIMEOUT,
  loadedListings,
  openContract,
  reviewCounts,
  test,
} from "./fixtures";

// Every control on an app's page, read-only.

/** Opens the most-reviewed app, or skips when nothing is reviewed. */
async function openReviewed(
  page: Page,
  need: (count: { total: number; written: number }) => boolean = () => true,
) {
  const counts = [...(await reviewCounts())]
    .filter(([, count]) => need(count))
    .sort(([, left], [, right]) => right.total - left.total);
  test.skip(!counts.length, "No reviewed app fits this test.");
  await openContract(page, counts[0][0]);
  await detailLoaded(page);
  return counts[0];
}

test("the launch interstitial opens and cancels from an app page", async ({
  page,
}) => {
  const entries = await loadedListings(page);
  const launchable = entries.filter({
    has: page.getByRole("button", { name: "Launch ↗" }),
  });
  test.skip((await launchable.count()) === 0, "No listing has an app URL.");
  await launchable.first().locator(".entry-title").click();
  await detailLoaded(page);
  await expectNoHorizontalOverflow(page);

  const launch = page.locator(".detail-hero-actions").getByRole("button", {
    name: "Launch ↗",
  });
  const dialog = page.getByRole("dialog", {
    name: "Continue to another site?",
  });
  await launch.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".external-launch-trust strong")).toHaveText(
    /^(Official|Community) link$/,
  );
  await expect(
    dialog.getByRole("link", { name: "Continue ↗" }),
  ).toHaveAttribute("rel", /noopener/);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);

  await launch.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(launch).toBeFocused();
});

test("both Copy contract ID buttons copy the ID", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const entries = await loadedListings(page);
  await entries.first().locator(".entry-title").click();
  await detailLoaded(page);
  const copies = page.getByRole("button", { name: "Copy contract ID" });
  await expect(copies).toHaveCount(2);
  const id = (await copies.first().getAttribute("title"))!;
  expect(id).toMatch(/^[1-9A-HJ-NP-Za-km-z]{42,44}$/);

  for (const index of [0, 1]) {
    await page.evaluate(() => navigator.clipboard.writeText(""));
    await page
      .getByRole("button", { name: /Copy contract ID|copied/ })
      .nth(index)
      .click();
    await expect(
      page.getByRole("button", { name: "Contract ID copied" }),
    ).toHaveText("Copied ✓");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(id);
    await expect(
      page.getByRole("button", { name: "Contract ID copied" }),
    ).toHaveCount(0, { timeout: 5_000 });
  }
});

test("Switch listing shows every listing and picks one", async ({ page }) => {
  test.setTimeout(90_000);
  const contractId = await contractWithListings(2);
  test.skip(!contractId, "No contract has more than one listing.");
  await openContract(page, contractId!);
  await detailLoaded(page);
  const listings = page.getByRole("region", { name: "App listings" });
  const toggle = listings.getByRole("button", { name: /Switch listing/ });
  await toggle.click();
  await expect(
    listings.getByRole("button", { name: /Hide listings/ }),
  ).toBeVisible();
  const radios = listings.getByRole("radio");
  expect(await radios.count()).toBeGreaterThan(1);
  await expect(radios.first()).toBeChecked();

  const more = listings.getByRole("button", { name: "Load more listings" });
  if (await more.isVisible()) {
    const before = await radios.count();
    await more.click();
    await expect
      .poll(() => radios.count(), { timeout: LOAD_TIMEOUT })
      .toBeGreaterThan(before);
  }

  const second = listings.locator(".listing-options label").nth(1);
  const name = (await second.locator("span strong").nth(1).textContent())!
    .split(" · ")[0]
    .trim();
  await second.getByRole("radio").check();
  await expect(second.getByRole("radio")).toBeChecked();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  await expect(listings.locator(".listing-switcher-bar strong")).toHaveText(
    "community",
  );
  await listings.getByRole("button", { name: /Hide listings/ }).click();
  await expect(radios).toHaveCount(0);
});

test("Technical details expand and collapse", async ({ page }) => {
  const entries = await loadedListings(page);
  await entries.first().locator(".entry-title").click();
  await detailLoaded(page);
  const details = page.locator("details.technical-details");
  const summary = details.locator("summary");
  const types = details.locator(".document-types");
  await expect(types).toBeHidden();

  await summary.click();
  await expect(details).toHaveAttribute("open", "");
  await expect(types).toBeVisible();
  await expect(details.locator(".contract-owner-fact code")).toHaveText(
    /^[1-9A-HJ-NP-Za-km-z]{42,44}$/,
  );
  const refresh = details.getByRole("button", { name: "Refresh" });
  await refresh.click();
  await expect(refresh).toBeEnabled({ timeout: LOAD_TIMEOUT });
  await expect(types).toBeVisible();

  await summary.click();
  await expect(details).not.toHaveAttribute("open", "");
  await expect(types).toBeHidden();
});

test("the Technical details toggle says Collapse while open", async ({
  page,
}) => {
  test.fail(true, "The summary label stays 'Expand' when the section is open");
  const entries = await loadedListings(page);
  await entries.first().locator(".entry-title").click();
  await detailLoaded(page);
  const summary = page.locator("details.technical-details summary");
  await expect(summary).toContainText("Expand");
  await summary.click();
  await expect(summary).toContainText("Collapse");
});

test("review sort chips and Written only reorder and filter reviews", async ({
  page,
}) => {
  await openReviewed(page);
  const ratings = page.getByRole("region", { name: "Ratings and reviews" });
  const sorts = ratings.getByLabel("Sort ratings");
  const cards = ratings.locator("li.rating-card");
  await expect(cards.first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  const stars = () =>
    cards.evaluateAll((nodes) =>
      nodes.map(
        (node) =>
          Number(
            /(\d(?:\.\d)?)/.exec(
              node.querySelector(".star-meter")?.getAttribute("aria-label") ??
                "",
            )?.[1],
          ) || 0,
      ),
    );
  const total = await cards.count();

  for (const [label, order] of [
    ["Highest rated", -1],
    ["Lowest rated", 1],
    ["Most recent", 0],
  ] as const) {
    const chip = sorts.getByRole("button", { name: label });
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(ratings.getByText("Loading ratings…")).toHaveCount(0, {
      timeout: LOAD_TIMEOUT,
    });
    await expect(cards).toHaveCount(total);
    if (order) {
      const values = await stars();
      for (let index = 1; index < values.length; index++)
        expect(
          order * (values[index] - values[index - 1]),
        ).toBeGreaterThanOrEqual(0);
    }
  }

  const written = sorts.getByRole("button", { name: "Written only" });
  await written.click();
  await expect(written).toHaveAttribute("aria-pressed", "true");
  await expect(cards.locator(".rating-body.muted")).toHaveCount(0);
  if ((await cards.count()) === 0)
    await expect(ratings.locator(".rating-empty")).toHaveText(
      /No written reviews (loaded )?yet\./,
    );
  await written.click();
  await expect(written).toHaveAttribute("aria-pressed", "false");
  await expect(cards).toHaveCount(total);
});

test("a histogram bar filters by star and the filter clears", async ({
  page,
}) => {
  await openReviewed(page);
  const ratings = page.getByRole("region", { name: "Ratings and reviews" });
  const bars = ratings
    .getByRole("group", { name: "Ratings by star" })
    .getByRole("button");
  const cards = ratings.locator("li.rating-card");
  await expect(cards.first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  const total = await cards.count();
  const labels = await bars.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("aria-label") ?? ""),
  );
  const index = labels.findIndex((label) => !label.endsWith(": 0"));
  const [, star, count] = /^(\d) stars?: (\d+)$/.exec(labels[index])!;
  const bar = bars.nth(index);
  const sorts = ratings.getByLabel("Sort ratings");

  await bar.click();
  await expect(bar).toHaveAttribute("aria-pressed", "true");
  await expect(ratings.locator(".rating-filter-note")).toContainText(
    `Showing ${star}-star ratings only.`,
  );
  await expect(
    sorts.getByRole("button", { name: "Highest rated" }),
  ).toBeDisabled();
  await expect(cards).toHaveCount(Math.min(Number(count), 25), {
    timeout: LOAD_TIMEOUT,
  });

  await ratings.getByRole("button", { name: "Clear filter" }).click();
  await expect(bar).toHaveAttribute("aria-pressed", "false");
  await expect(ratings.locator(".rating-filter-note")).toHaveCount(0);
  await expect(
    sorts.getByRole("button", { name: "Highest rated" }),
  ).toBeEnabled();
  await expect(cards).toHaveCount(total, { timeout: LOAD_TIMEOUT });

  await bar.click();
  await expect(bar).toHaveAttribute("aria-pressed", "true");
  await bar.click();
  await expect(bar).toHaveAttribute("aria-pressed", "false");

  const empty = labels.findIndex((label) => label.endsWith(": 0"));
  if (empty >= 0) {
    await bars.nth(empty).click();
    await expect(ratings.locator(".rating-empty")).toHaveText(
      /^No \d-star ratings yet\.$/,
      { timeout: LOAD_TIMEOUT },
    );
  }
});

test("Load more reviews appends the next page", async ({ page }) => {
  await openReviewed(page, (count) => count.total > 25);
  const ratings = page.getByRole("region", { name: "Ratings and reviews" });
  const cards = ratings.locator("li.rating-card");
  await expect(cards).toHaveCount(25, { timeout: LOAD_TIMEOUT });
  await ratings.getByRole("button", { name: "Load more" }).click();
  await expect
    .poll(() => cards.count(), { timeout: LOAD_TIMEOUT })
    .toBeGreaterThan(25);
});

test("the hero rating jumps to the reviews", async ({ page }) => {
  await openReviewed(page);
  await page.locator(".hero-rating").click();
  await expect(page).toHaveURL(/#app-ratings$/);
  await expect(
    page.getByRole("region", { name: "Ratings and reviews" }),
  ).toBeInViewport();
});

test("Sign in to rate opens the sign-in dialog", async ({ page }) => {
  const entries = await loadedListings(page);
  await entries.first().locator(".entry-title").click();
  await detailLoaded(page);
  const button = page.getByRole("button", { name: "Sign in to rate" });
  await button.click();
  const dialog = page.getByRole("dialog", { name: "Sign in to dashapps" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Mnemonic or private key")).toBeFocused();
  await dialog.getByRole("button", { name: "Close sign in" }).click();
  await expect(dialog).toHaveCount(0);

  await button.click();
  await page.mouse.click(5, 5);
  await expect(dialog).toHaveCount(0);
});

test("resource links open in a new tab", async ({ page }) => {
  const entries = await loadedListings(page);
  await entries.first().locator(".entry-title").click();
  await detailLoaded(page);
  const links = page.locator(".resource-list a, .detail-hero-actions a");
  for (const link of await links.all()) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("href", /^https?:\/\//);
  }
});
