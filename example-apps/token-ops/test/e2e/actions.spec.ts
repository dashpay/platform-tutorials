import { test, expect } from "./fixtures";

/**
 * Actions view — read-only coverage.
 *
 * The Actions tab stacks two panels: the proposal form (propose mint / burn /
 * freeze / unfreeze / destroy-frozen / emergency / direct transfer) above the
 * pending-action queue (ACTIVE proposals + signer progress). These specs drive
 * the real app against testnet and assert the signed-out read-only state; no
 * chain write is performed.
 *
 * The empty-vs-populated queue fork and per-card expand are data-dependent on
 * what the default contract currently has pending, so they `test.skip` cleanly
 * when the live chain shows the other branch (mirroring overview.spec's
 * inspector read).
 *
 * Deferred to a future write-flow pass (not covered here):
 *   - propose mint / burn / freeze / unfreeze  (needs HAS_MNEMONIC)
 *   - propose emergency pause / resume         (needs HAS_MNEMONIC)
 *   - direct transfer                          (needs HAS_MNEMONIC + tokens)
 *   - co-sign a pending action                 (needs HAS_MNEMONIC + membership)
 *   - 2-of-3 co-sign → execute round-trip      (needs HAS_GROUP_IDENTITIES)
 * The irreversible destroyFrozen path stays behind an explicit manual flag
 * even when write flows are added.
 */
test.describe("Actions — propose (read-only)", () => {
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

test.describe("Actions — pending (read-only)", () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole("button", { name: "Actions", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Review pending actions" }),
    ).toBeVisible({ timeout: 60_000 });
  });

  test("toolbar shows freshness and an operable refresh", async ({ page }) => {
    // The toolbar settles from "Loading..." to an "Updated <time>" stamp once
    // the first fetch resolves.
    await expect(page.getByText(/^Updated /)).toBeVisible({ timeout: 60_000 });

    const refresh = page.getByRole("button", { name: "Refresh", exact: true });
    await expect(refresh).toBeEnabled();
    await refresh.click();
    // A re-fetch keeps the stamp present (it never reverts to "Loading...").
    await expect(page.getByText(/^Updated /)).toBeVisible({ timeout: 60_000 });
  });

  test("renders either the empty state or the action sections", async ({
    page,
  }) => {
    await expect(page.getByText(/^Updated /)).toBeVisible({ timeout: 60_000 });
    await expect(
      page.locator(".empty-state, .proposal-card").first(),
    ).toBeVisible();
  });

  test("exposes no signing controls when signed out", async ({ page }) => {
    await expect(page.getByText(/^Updated /)).toBeVisible({ timeout: 60_000 });

    // Co-sign is gated on an authenticated group member, so signed out none of
    // the signing controls render regardless of what's pending.
    await expect(
      page.getByRole("button", { name: /Add your signature/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Sign & execute/ }),
    ).toHaveCount(0);
  });

  test("expands a proposal card's details when actions exist", async ({
    page,
  }) => {
    await expect(page.getByText(/^Updated /)).toBeVisible({ timeout: 60_000 });

    const card = page.locator(".proposal-card").first();
    // Details expand is only reachable when the contract has a live pending
    // action; skip rather than fail when there's nothing to expand.
    test.skip(
      (await card.count()) === 0,
      "No pending actions on the default contract — skipping card expand.",
    );

    const details = card.getByRole("button", { name: "Details", exact: true });
    await details.click();
    await expect(
      card.getByRole("button", { name: "Hide details", exact: true }),
    ).toBeVisible();
    // The expanded card reveals the Approval group / Action ID metadata.
    await expect(card.getByText("Action ID")).toBeVisible();
  });
});
