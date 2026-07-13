import { test, expect } from "./fixtures";

/**
 * Operations view — read-only coverage.
 *
 * Signed out, the view renders every operation section but disables all
 * submission controls. These specs drive the real app against testnet and
 * assert that read-only state; no chain write is performed.
 *
 * Deferred to a future write-flow pass (not covered here):
 *   - propose mint / burn / freeze / unfreeze  (needs HAS_MNEMONIC)
 *   - propose emergency pause / resume         (needs HAS_MNEMONIC)
 *   - direct transfer                          (needs HAS_MNEMONIC + tokens)
 *   - 2-of-3 co-sign → execute round-trip      (needs HAS_GROUP_IDENTITIES)
 * The irreversible destroyFrozen path stays behind an explicit manual flag
 * even when write flows are added.
 */
test.describe("Operations (read-only)", () => {
  test("shows the read-only notice and read-only eligibility pill", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Operations", exact: true }).click();

    await expect(
      page.getByText(/Sign in to propose or run token operations/),
    ).toBeVisible();
    await expect(
      page.locator(".eligibility-pill", { hasText: "Read-only" }),
    ).toBeVisible();
  });

  test("renders all four operation sections", async ({ page }) => {
    await page.getByRole("button", { name: "Operations", exact: true }).click();

    for (const heading of ["Supply", "Access", "Emergency", "Transfer"]) {
      await expect(
        page.getByRole("heading", { name: heading, level: 3 }),
      ).toBeVisible({ timeout: 60_000 });
    }
  });

  test("submission controls are disabled when signed out", async ({ page }) => {
    await page.getByRole("button", { name: "Operations", exact: true }).click();

    // Fields are present read-only, but every submit button is disabled.
    await expect(page.getByLabel("Supply amount")).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByRole("button", { name: "Propose mint" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Propose burn...", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Propose freeze", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Propose unfreeze", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Propose pause", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Propose resume", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Transfer", exact: true }),
    ).toBeDisabled();
  });
});
