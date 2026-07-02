import { test, expect } from "@playwright/test";

const LITE_URL = "/dashrate-lite.html";

test.describe("dashrate-lite (single-file companion)", () => {
  test("connects to testnet and enables controls on load", async ({ page }) => {
    await page.goto(LITE_URL);

    await expect(page.locator("#status")).toHaveText(/Connected to testnet/, {
      timeout: 60_000,
    });
    await expect(page.locator("#refresh-btn")).toBeEnabled({
      timeout: 60_000,
    });
    await expect(page.locator("#rating-filter")).toBeEnabled();
  });

  test("renders resource navigation, aggregate panel, and recent reviews", async ({
    page,
  }) => {
    await page.goto(LITE_URL);
    await expect(page.locator("#status")).toHaveText(/Connected to testnet/, {
      timeout: 60_000,
    });

    await expect(
      page.getByRole("heading", { name: "Platform Introduction", level: 2 }),
    ).toBeVisible();
    await expect(page.locator("#aggregate-result .summary-grid")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("#reviews-result")).toContainText(
      /review|No reviews/i,
      { timeout: 60_000 },
    );
  });

  test("selecting a resource updates the detail view", async ({ page }) => {
    await page.goto(LITE_URL);
    await expect(page.locator("#status")).toHaveText(/Connected to testnet/, {
      timeout: 60_000,
    });

    await page
      .locator('nav[aria-label="Tutorial resources"] button')
      .filter({ hasText: "Tokens" })
      .click();

    await expect(
      page.getByRole("heading", { name: "Tokens", level: 2 }),
    ).toBeVisible();
    await expect(page.locator("#aggregate-result .summary-grid")).toBeVisible({
      timeout: 60_000,
    });
  });

  test("rating filter updates the review query view", async ({ page }) => {
    await page.goto(LITE_URL);
    await expect(page.locator("#status")).toHaveText(/Connected to testnet/, {
      timeout: 60_000,
    });

    await page.locator("#rating-filter").selectOption("5");
    await expect(
      page.getByRole("heading", { name: "5-star reviews", level: 2 }),
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("#reviews-result")).toContainText(
      /5-star review|No 5-star reviews/i,
      { timeout: 60_000 },
    );
  });

  test("refresh keeps the selected resource usable", async ({ page }) => {
    await page.goto(LITE_URL);
    await expect(page.locator("#status")).toHaveText(/Connected to testnet/, {
      timeout: 60_000,
    });

    await page
      .locator('nav[aria-label="Tutorial resources"] button')
      .filter({ hasText: "Dashnote" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Dashnote", level: 2 }),
    ).toBeVisible();

    await page.locator("#refresh-btn").click();
    await expect(page.locator("#refresh-btn")).toBeEnabled({
      timeout: 60_000,
    });
    await expect(
      page.getByRole("heading", { name: "Dashnote", level: 2 }),
    ).toBeVisible();
    await expect(page.locator("#aggregate-result .summary-grid")).toBeVisible({
      timeout: 60_000,
    });
  });
});
