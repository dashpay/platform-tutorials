import { test, expect } from "./fixtures";

test("How it works tab renders without login", async ({ page }) => {
  await page.getByRole("button", { name: /how it works/i }).click();
  await expect(
    page.getByRole("heading", { name: /how it works/i }),
  ).toBeVisible();
});
