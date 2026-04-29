import { test, expect, waitForBrowsingReady } from "./fixtures";

const STORAGE_KEY = "dashproof-lab.theme";

test.describe("Theme toggle", () => {
  test("toggles theme and persists across reload", async ({ page }) => {
    await page.goto("/");
    await waitForBrowsingReady(page);

    const initial = await page.evaluate(
      () => document.documentElement.dataset.theme ?? "dark",
    );
    const expectedNext = initial === "dark" ? "light" : "dark";

    // Click the first matching toggle (sidebar on desktop, header on mobile).
    const toggle = page.getByRole("button", {
      name: /Switch to (light|dark) theme/,
    }).first();
    await toggle.click();

    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.dataset.theme),
      )
      .toBe(expectedNext);

    // Persisted to localStorage under the same key the hook uses.
    const stored = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      STORAGE_KEY,
    );
    expect(stored).toBe(expectedNext);

    await page.reload();
    await waitForBrowsingReady(page);

    const afterReload = await page.evaluate(
      () => document.documentElement.dataset.theme,
    );
    expect(afterReload).toBe(expectedNext);
  });
});
