import { test, expect } from "./fixtures";

test.describe("Read-only browsing", () => {
  test("app boots and shows TokenOps navigation", async ({ page }) => {
    await expect(page.getByText("TokenOps")).toBeVisible();
    for (const label of [
      "Overview",
      "Operations",
      "Pending actions",
      "Governance",
      "Account",
    ]) {
      await expect(page.getByRole("button", { name: label })).toBeVisible();
    }
  });

  test("governance view renders without signing in", async ({ page }) => {
    await page.getByRole("button", { name: "Governance" }).click();
    await expect(
      page.getByRole("heading", { name: "Capabilities" }),
    ).toBeVisible();
  });
});
