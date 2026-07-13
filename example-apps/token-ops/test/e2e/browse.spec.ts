import { test, expect } from "./fixtures";

test.describe("Read-only browsing", () => {
  test("app boots and shows TokenOps navigation", async ({ page }) => {
    await expect(page.getByText("TokenOps")).toBeVisible();
    for (const label of [
      "Overview",
      "Operations",
      "Pending",
      "Governance",
      "Settings",
    ]) {
      // `exact` so the "Operations" nav button doesn't also match the
      // "Pending operations" card button in the Token details panel.
      await expect(
        page.getByRole("button", { name: label, exact: true }),
      ).toBeVisible();
    }
  });

  test("overview shows token name and description", async ({ page }) => {
    const header = page.locator(".token-header");
    // Name headlines the overview (capitalized per the token's
    // shouldCapitalize convention); description sits beneath it. Both come
    // from the default contract's on-chain token conventions.
    await expect(header.getByRole("heading", { name: "TokenOps" })).toBeVisible(
      { timeout: 60_000 },
    );
    await expect(header.locator("p")).toContainText("group-governed");
  });

  test("governance view renders without signing in", async ({ page }) => {
    await page.getByRole("button", { name: "Governance" }).click();
    // Access control and Groups are subnav tabs; the access pane (default)
    // shows the Capability authority matrix heading.
    await expect(page.getByRole("tab", { name: "Access control" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Groups" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Capability authority", level: 4 }),
    ).toBeVisible();
  });

  test("pending view does not overflow horizontally on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole("button", { name: "Pending", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "Pending group actions" }),
    ).toBeVisible();
    await expect(page.getByText(/^Updated /)).toBeVisible({ timeout: 60_000 });
    await expect(
      page.locator(".empty-state, .proposal-card").first(),
    ).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  });
});
