import { test, expect, navTo, selectResource } from "./fixtures";

// Shell smoke tests: assert navigation and static rendering of the read-only
// UI. They do NOT assert on live rating data (counts/distributions vary with
// the network); query correctness is covered by the src/dash/queries.ts unit
// tests. Runs under both chromium-desktop and chromium-mobile projects.

test.describe("boot", () => {
  test("page title is DashRate", async ({ page }) => {
    await expect(page).toHaveTitle(/DashRate/i);
  });

  test("brand and primary navigation render", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "DashRate", level: 1 }),
    ).toBeVisible();
    const nav = page.locator('nav[aria-label="Primary navigation"]');
    for (const label of [
      "Resources",
      "My reviews",
      "Settings",
      "How it works",
    ]) {
      await expect(
        nav.getByRole("button", { name: label, exact: true }),
      ).toBeVisible();
    }
  });
});

test.describe("tab navigation", () => {
  test("switches between Resources and How it works", async ({ page }) => {
    await navTo(page, "How it works");
    await expect(
      page.getByRole("heading", { name: /how it works/i }),
    ).toBeVisible();

    await navTo(page, "Resources");
    await expect(
      page.locator('aside[aria-label="Tutorial resources"]'),
    ).toBeVisible();
  });
});

test.describe("browse a resource", () => {
  test("selecting a resource renders its detail head and the rating-stats block", async ({
    page,
  }) => {
    await selectResource(page, "Tokens");

    // The detail head shows the selected resource title.
    await expect(
      page.getByRole("heading", { name: "Tokens", level: 2 }),
    ).toBeVisible();

    // Aggregate rating block renders (score is "—" or a number depending on
    // live testnet data) with a StarMeter.
    const stats = page.locator('[aria-label="Aggregate rating stats"]');
    await expect(stats).toBeVisible();
    await expect(stats.getByRole("img")).toBeVisible();

    // The review section header is always present; the count varies with
    // live data, so assert the section, not a specific number.
    await expect(
      page.getByRole("heading", { name: /recent reviews/i }),
    ).toBeVisible();
  });

  test("the leaderboard and 4★+ filter render", async ({ page }) => {
    const board = page.locator('section[aria-label="Leaderboards"]');
    await expect(
      board.getByRole("button", { name: "Top rated" }),
    ).toBeVisible();
    await expect(
      board.getByRole("button", { name: "Most reviewed" }),
    ).toBeVisible();
    // Rows (or "No ratings yet.") once the ranked queries return.
    await expect(
      board.locator(".leaderboard-row, .leaderboard-empty").first(),
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("button", { name: "4★+ average" })).toBeEnabled(
      { timeout: 60_000 },
    );
  });

  test("the review form prompts sign-in when signed out", async ({ page }) => {
    await selectResource(page, "Tokens");
    await expect(
      page.getByText("Sign in to review this resource"),
    ).toBeVisible();
  });
});
