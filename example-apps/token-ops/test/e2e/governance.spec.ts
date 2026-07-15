import { test, expect } from "./fixtures";

/**
 * Governance view — read-only coverage.
 *
 * Exercises the Access-control matrices and the Groups pane search / filter /
 * sort / expand controls against the live default contract. Reassigning an
 * operator and appending a group are signed-in write flows, deferred to the
 * future write-flow pass; here we assert those controls are absent read-only.
 */
test.describe("Governance (read-only)", () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole("button", { name: "Governance", exact: true }).click();
  });

  test("access control renders both authority matrices", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Capability authority", level: 4 }),
    ).toBeVisible({ timeout: 60_000 });
    await expect(
      page.getByRole("heading", { name: "Config authority", level: 4 }),
    ).toBeVisible();
    // Read-only: no per-row "Edit" reassign control when signed out.
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
  });

  test("groups pane lists groups and expands a row", async ({ page }) => {
    await page.getByRole("tab", { name: "Groups" }).click();

    const rows = page.locator(".group-table-row");
    await expect(rows.first()).toBeVisible({ timeout: 60_000 });

    const expander = rows.first().locator("button.group-row-main");
    await expect(expander).toHaveAttribute("aria-expanded", "false");
    await expander.click();
    await expect(expander).toHaveAttribute("aria-expanded", "true");
    await expect(
      rows.first().getByRole("heading", { name: "Members", level: 5 }),
    ).toBeVisible();
    await expect(
      rows
        .first()
        .getByRole("heading", { name: "Assigned capabilities", level: 5 }),
    ).toBeVisible();
  });

  test("groups filter narrows the visible rows", async ({ page }) => {
    await page.getByRole("tab", { name: "Groups" }).click();
    const rows = page.locator(".group-table-row");
    await expect(rows.first()).toBeVisible({ timeout: 60_000 });
    const allCount = await rows.count();

    // "Groups I'm in" while signed out resolves to zero → empty-state note.
    await page.locator("#group-filter").selectOption("mine");
    await expect(
      page.getByText("No groups match the current search and filters."),
    ).toBeVisible();

    await page.locator("#group-filter").selectOption("all");
    await expect(rows).toHaveCount(allCount);
  });

  test("groups search filters by term", async ({ page }) => {
    await page.getByRole("tab", { name: "Groups" }).click();
    const rows = page.locator(".group-table-row");
    await expect(rows.first()).toBeVisible({ timeout: 60_000 });

    await page
      .locator("#group-search")
      .fill("zzz-no-such-group-member-or-capability");
    await expect(
      page.getByText("No groups match the current search and filters."),
    ).toBeVisible();
  });

  test("groups sort control is operable", async ({ page }) => {
    await page.getByRole("tab", { name: "Groups" }).click();
    const rows = page.locator(".group-table-row");
    await expect(rows.first()).toBeVisible({ timeout: 60_000 });

    for (const value of ["members", "threshold", "capabilities", "position"]) {
      await page.locator("#group-sort").selectOption(value);
      await expect(rows.first()).toBeVisible();
    }
  });

  test("append-group form is hidden when signed out", async ({ page }) => {
    await page.getByRole("tab", { name: "Groups" }).click();
    await expect(page.locator(".group-table-row").first()).toBeVisible({
      timeout: 60_000,
    });

    await expect(page.locator("#new-members")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Append group" }),
    ).toHaveCount(0);
  });
});
