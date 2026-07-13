import { test, expect } from "./fixtures";

test.describe("Read-only browsing", () => {
  test("app boots and shows TokenOps navigation", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "TokenOps", level: 1 }),
    ).toBeVisible();
    for (const label of [
      "Dashboard",
      "Operations",
      "Pending",
      "Governance",
      "Settings",
    ]) {
      await expect(
        page.getByRole("button", { name: label, exact: true }),
      ).toBeVisible();
    }
  });

  test("dashboard leads with governance and keeps token context", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Governance at a glance" }),
    ).toBeVisible({ timeout: 60_000 });
    await expect(
      page.getByRole("heading", { name: "Who controls what" }),
    ).toBeVisible();

    const authorityCards = page.locator(".dashboard-group-card");
    await expect(authorityCards.first()).toBeVisible();

    const tokenCard = page.locator(".dashboard-token-card");
    await expect(
      tokenCard.getByRole("heading", { name: "TokenOps", level: 3 }),
    ).toBeVisible();
    await expect(tokenCard.getByText("Check balances")).toBeVisible();
    await expect(
      tokenCard.locator("details.dashboard-identity-inspector"),
    ).not.toHaveAttribute("open", "");
  });

  test("governance view renders without signing in", async ({ page }) => {
    await page.getByRole("button", { name: "Governance", exact: true }).click();
    // Access control and Groups are subnav tabs; the access pane (default)
    // shows the Capability authority matrix heading.
    await expect(
      page.getByRole("tab", { name: "Access control" }),
    ).toBeVisible();
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
