import { expect, test } from "@playwright/test";
test("read-only discovery boots and remains usable on mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Built on Dash Platform" }),
  ).toBeVisible();
  await expect(page.getByLabel("Network")).toHaveCount(0);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByLabel("Discover by keyword")).toBeVisible();
  await expect(page.getByLabel("Open a contract")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
