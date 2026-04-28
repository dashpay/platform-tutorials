import { test as base, expect } from "@playwright/test";

// This spec doesn't use the shared `page` fixture because it needs to seed
// localStorage *before* the first navigation and assert the app survives a
// bogus contract id without crashing.
const test = base;

test("App stays usable when localStorage holds a bogus contract id", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "dashmint-lab.contractId",
      "0".repeat(44),
    );
  });
  await page.goto("/");

  // Sidebar still renders even if the contract fetch fails.
  await expect(
    page.getByRole("navigation").getByRole("button", { name: /collection/i }),
  ).toBeVisible({ timeout: 60_000 });

  await page.getByRole("button", { name: "All" }).click();
  await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

  // Either the empty-state copy or zero rendered articles is acceptable — the
  // important property is that the page didn't blow up.
  const articles = page.locator("article");
  const empty = page.getByText(/no cards found/i);
  await expect(articles.first().or(empty)).toBeVisible();
});
