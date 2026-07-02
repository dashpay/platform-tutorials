import { test, expect } from "./fixtures";

test.describe("Read-only browsing (no auth required)", () => {
  test("app boots and shows the tab navigation", async ({ page }) => {
    await expect(page.getByText("DashBounty")).toBeVisible();
    for (const label of [
      "Submit report",
      "Browse reports",
      "My reports",
      "Triage panel",
      "Roster",
      "Account",
    ]) {
      await expect(page.getByRole("button", { name: label })).toBeVisible();
    }
  });

  test("Browse reports view renders without signing in", async ({ page }) => {
    await page.getByRole("button", { name: "Browse reports" }).click();
    await expect(page.getByLabel("Filter by severity")).toBeVisible();
    await expect(page.getByLabel("Filter by component")).toBeVisible();
  });

  test("Triage panel view renders without signing in", async ({ page }) => {
    await page.getByRole("button", { name: "Triage panel" }).click();
    // Renders the panel dashboard once a contract is configured
    // (DEFAULT_CONTRACT_ID or a saved override), otherwise the
    // "configure a contract" prompt — either is a valid mounted state.
    await expect(
      page.getByText(/Triage Panel|Configure a bounty contract first/),
    ).toBeVisible();
  });
});
