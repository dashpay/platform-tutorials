import { test as base, expect } from "@playwright/test";

// Mobile viewport spec — bypass the shared fixture so we can size the
// viewport before navigation.
const test = base;
test.use({ viewport: { width: 390, height: 844 } });

test("Mobile hamburger toggles the navigation drawer", async ({ page }) => {
  await page.goto("/");

  const hamburger = page.getByRole("button", { name: /open menu/i });
  await expect(hamburger).toBeVisible();

  // The desktop nav is hidden behind a CSS translate on small viewports; the
  // sidebar's <button> for "Collection" still exists in the DOM but is
  // positioned offscreen. After hamburger click it slides in.
  const collectionNavBtn = page
    .getByRole("navigation")
    .getByRole("button", { name: /collection/i });

  await hamburger.click();
  await expect(collectionNavBtn).toBeInViewport();

  // Click outside the drawer (top-right corner is the backdrop).
  await page.mouse.click(380, 10);
  await expect(collectionNavBtn).not.toBeInViewport();
});
