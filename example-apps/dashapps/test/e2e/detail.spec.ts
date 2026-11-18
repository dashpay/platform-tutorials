import type { Page } from "@playwright/test";
import {
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

/** Opens the first listed app, preferring one with an app URL. */
async function openListed(page: Page) {
  const entries = await loadedListings(page);
  const launchable = entries.filter({
    has: page.getByRole("button", { name: "Launch ↗" }),
  });
  const entry = (await launchable.count()) ? launchable : entries;
  await entry.first().locator(".entry-title").click();
  await detailLoaded(page);
}

/** Opens the most-reviewed app, or skips when nothing fits. */
async function openReviewed(
  page: Page,
  need: (count: { total: number; written: number }) => boolean = () => true,
) {
  const reviewed = (await reviewCounts()).find(([, count]) => need(count));
  test.skip(!reviewed, "No reviewed app fits this test.");
  await openContract(page, reviewed![0]);
  await detailLoaded(page);
  return page.getByRole("region", { name: "Ratings and reviews" });
}

test("an app's launch, copy and resource links", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openListed(page);
  await expectNoHorizontalOverflow(page);

  const launch = page.locator(".detail-hero-actions").getByRole("button", {
    name: "Launch ↗",
  });
  if (await launch.isVisible()) {
    const dialog = page.getByRole("dialog", {
      name: "Continue to another site?",
    });
    await launch.click();
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
  }

  for (const link of await page
    .locator(".resource-list a, .detail-hero-actions a")
    .all()) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("href", /^https?:\/\//);
  }

  const copies = page.getByRole("button", { name: "Copy contract ID" });
  await expect(copies).toHaveCount(2);
  const id = (await copies.first().getAttribute("title"))!;
  expect(id).toMatch(/^[1-9A-HJ-NP-Za-km-z]{42,44}$/);
  const copied = page.getByRole("button", { name: "Contract ID copied" });
  for (const index of [0, 1]) {
    await page.evaluate(() => navigator.clipboard.writeText(""));
    await page
      .getByRole("button", { name: /Copy contract ID|copied/ })
      .nth(index)
      .click();
    await expect(copied).toHaveText("Copied ✓");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(id);
    await expect(copied).toHaveCount(0, { timeout: 5_000 });
  }
});

test("Technical details expand, refresh and collapse", async ({ page }) => {
  await openListed(page);
  const details = page.locator("details.technical-details");
  const summary = details.locator("summary");
  const types = details.locator(".document-types");
  await expect(types).toBeHidden();
  await expect(summary).toContainText("Expand");

  await summary.click();
  await expect(types).toBeVisible();
  await expect(summary).toContainText("Collapse");
  await expect(details.locator(".contract-owner-fact code")).toHaveText(
    /^[1-9A-HJ-NP-Za-km-z]{42,44}$/,
  );
  const refresh = details.getByRole("button", { name: "Refresh" });
  await refresh.click();
  await expect(refresh).toBeEnabled({ timeout: LOAD_TIMEOUT });
  await expect(types).toBeVisible();

  await summary.click();
  await expect(types).toBeHidden();
  await expect(summary).toContainText("Expand");
});

test("reviews sort, filter by star and Written only, page and link", async ({
  page,
}) => {
  const ratings = await openReviewed(page);
  const sorts = ratings.getByLabel("Sort ratings");
  const cards = ratings.locator("li.rating-card");
  await expect(cards.first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  const total = await cards.count();
  const stars = () =>
    cards.evaluateAll((nodes) =>
      nodes.map((node) =>
        Number(
          /(\d)/.exec(
            node.querySelector(".star-meter")?.getAttribute("aria-label") ?? "",
          )?.[1] ?? 0,
        ),
      ),
    );

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
    const values = await stars();
    for (let index = 1; index < values.length; index++)
      expect(
        order * (values[index] - values[index - 1]),
      ).toBeGreaterThanOrEqual(0);
  }

  const written = sorts.getByRole("button", { name: "Written only" });
  await written.click();
  await expect(written).toHaveAttribute("aria-pressed", "true");
  await expect(cards.locator(".rating-body.muted")).toHaveCount(0);
  await written.click();
  await expect(cards).toHaveCount(total);

  const bars = ratings
    .getByRole("group", { name: "Ratings by star" })
    .getByRole("button");
  const labels = await bars.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("aria-label") ?? ""),
  );
  const index = labels.findIndex((label) => !label.endsWith(": 0"));
  const [, star, count] = /^(\d) stars?: (\d+)$/.exec(labels[index])!;
  const bar = bars.nth(index);
  const highest = ratings.getByRole("button", { name: "Highest rated" });

  await bar.click();
  await expect(bar).toHaveAttribute("aria-pressed", "true");
  await expect(ratings.locator(".rating-filter-note")).toContainText(
    `Showing ${star}-star ratings only.`,
  );
  await expect(highest).toBeDisabled();
  await expect(cards).toHaveCount(Math.min(Number(count), 25), {
    timeout: LOAD_TIMEOUT,
  });
  await ratings.getByRole("button", { name: "Clear filter" }).click();
  await expect(bar).toHaveAttribute("aria-pressed", "false");
  await expect(highest).toBeEnabled();
  await expect(cards).toHaveCount(total, { timeout: LOAD_TIMEOUT });

  const empty = labels.findIndex((label) => label.endsWith(": 0"));
  if (empty >= 0) {
    await bars.nth(empty).click();
    await expect(ratings.locator(".rating-empty")).toHaveText(
      /^No \d-star ratings yet\.$/,
      { timeout: LOAD_TIMEOUT },
    );
    await bars.nth(empty).click();
  }

  if (total === 25) {
    await ratings.getByRole("button", { name: "Load more" }).click();
    await expect
      .poll(() => cards.count(), { timeout: LOAD_TIMEOUT })
      .toBeGreaterThan(25);
  }

  await page.locator(".hero-rating").click();
  await expect(page).toHaveURL(/#app-ratings$/);
  await expect(ratings).toBeInViewport();
});
