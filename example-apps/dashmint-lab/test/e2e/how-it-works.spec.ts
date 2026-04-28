import { test, expect } from "./fixtures";

test("How it works tab renders the screen header", async ({ page }) => {
  await page.getByRole("button", { name: /how it works/i }).click();
  await expect(
    page.getByRole("heading", { name: /how it works/i }),
  ).toBeVisible();
});

test("How it works tab renders all four sections", async ({ page }) => {
  await page.getByRole("button", { name: /how it works/i }).click();
  await expect(
    page.getByRole("heading", { name: /what is dashmint lab\?/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /platform operations at a glance/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /coming from ethereum\?/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /reading order/i }),
  ).toBeVisible();
});

test("Operations table maps Mint card → sdk.documents.create", async ({
  page,
}) => {
  await page.getByRole("button", { name: /how it works/i }).click();
  const row = page.locator("tr", { hasText: "Mint card" });
  await expect(row).toContainText("sdk.documents.create");
});
