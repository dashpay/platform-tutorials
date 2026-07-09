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
    await expect(
      page.getByRole("heading", { name: "Access control", level: 4 }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Groups" })).toBeVisible();
  });
});
