import { expect, test } from "@playwright/test";
test("read-only discovery boots without horizontal overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Built on Dash Platform" }),
  ).toBeVisible();
  await expect(page.getByLabel("Network")).toHaveCount(0);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByLabel("Discover by keyword")).toBeVisible();
  await expect(page.getByLabel("Open a contract")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("Settings opens the registry editor without saving", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Change" }).click();
  await expect(page.getByLabel("Registry contract ID")).toBeVisible();
  await expect(page.getByText("Registry selection saved.")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("dashapps.contractId.testnet"),
    ),
  ).toBeNull();
});
