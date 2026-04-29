import { test, expect, gotoHistory } from "./fixtures";

test.describe("History panel — chain lookup (read-only)", () => {
  test("loads anchors for a known chain ID", async ({ page }) => {
    await gotoHistory(page);

    // Without auth the panel forces "By chain" mode; the search input is the
    // ChainSearchForm field.
    const chainInput = page.getByPlaceholder("invoice-2026-04");
    await expect(chainInput).toBeVisible();

    await chainInput.fill("demo-proof-fixture-01");
    await page.getByRole("button", { name: "Load chain" }).click();

    // Either the chain header renders (success) or an empty/error notice
    // appears. Treat success as the timeline header showing the chainId.
    await expect(
      page
        .locator("text=demo-proof-fixture-01")
        .first(),
    ).toBeVisible({ timeout: 60_000 });

    // Document IDs link to Platform Explorer.
    await expect(
      page.locator('a[href^="https://testnet.platform-explorer.com/document/"]').first(),
    ).toBeVisible();
  });

  test('"My anchors" tab is disabled when not authenticated', async ({ page }) => {
    await gotoHistory(page);

    const myTab = page.getByRole("tab", { name: /My anchors/ });
    await expect(myTab).toBeDisabled();
  });
});
