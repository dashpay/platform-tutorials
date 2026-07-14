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
test.describe("Actions — operations (read-only)", () => {
  test("shows the read-only notice and proposal guidance", async ({ page }) => {
    await page.getByRole("button", { name: "Actions", exact: true }).click();

    await expect(page.getByText(/Sign in to submit an action/)).toBeVisible();
    await expect(
      page.getByText(
        "Explore supported token actions and their approval requirements.",
      ),
    ).toBeVisible();
  });

  test("renders the proposal selector", async ({ page }) => {
    await page.getByRole("button", { name: "Actions", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "Propose new action", level: 2 }),
    ).toBeVisible({ timeout: 60_000 });
    for (const action of [
      "Mint",
      "Burn",
      "Freeze",
      "Unfreeze",
      "Destroy frozen",
      "Pause",
      "Resume",
      "Transfer",
    ]) {
      await expect(
        page.getByRole("tab", { name: action, exact: true }),
      ).toBeVisible({ timeout: 60_000 });
    }
  });

  test("submission controls are disabled when signed out", async ({ page }) => {
    await page.getByRole("button", { name: "Actions", exact: true }).click();

    // Fields are present read-only, but every submit button is disabled.
    await expect(page.getByLabel("Mint amount")).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByRole("button", { name: /Propose mint/ }),
    ).toBeDisabled();
    await page.getByRole("tab", { name: "Burn", exact: true }).click();
    await expect(
      page.getByRole("button", { name: /Propose burn/ }),
    ).toBeDisabled();
    await page.getByRole("tab", { name: "Freeze", exact: true }).click();
    await expect(
      page.getByRole("button", { name: /Propose freeze/ }),
    ).toBeDisabled();
    await page.getByRole("tab", { name: "Unfreeze", exact: true }).click();
    await expect(
      page.getByRole("button", { name: /Propose unfreeze/ }),
    ).toBeDisabled();
    await page
      .getByRole("tab", { name: "Destroy frozen", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: /Propose destroy frozen/ }),
    ).toBeDisabled();
    await page.getByRole("tab", { name: "Pause", exact: true }).click();
    await expect(
      page.getByRole("button", { name: /Propose pause/ }),
    ).toBeDisabled();
    await page.getByRole("tab", { name: "Resume", exact: true }).click();
    await expect(
      page.getByRole("button", { name: /Propose resume/ }),
    ).toBeDisabled();
    await page.getByRole("tab", { name: "Transfer", exact: true }).click();
    await expect(page.getByRole("button", { name: /Transfer/ })).toBeDisabled();
  });
});
