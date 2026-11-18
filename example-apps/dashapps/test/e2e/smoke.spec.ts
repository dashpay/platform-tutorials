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
