import { test, expect } from "./fixtures";

/**
 * Pending group actions view — read-only coverage.
 *
 * Signed out, the view lists ACTIVE proposals and their signer progress but
 * exposes no signing controls (co-sign requires an authenticated member).
 * These specs drive the real app against testnet and assert that read-only
 * state; no chain write is performed.
 *
 * The empty-vs-populated fork and per-card expand are data-dependent on what
 * the default contract currently has pending, so they `test.skip` cleanly
 * when the live chain shows the other branch (mirroring overview.spec's
 * inspector read).
 *
 * Deferred to a future write-flow pass (not covered here):
 *   - co-sign a pending action                 (needs HAS_MNEMONIC + membership)
 *   - 2-of-3 co-sign → execute round-trip      (needs HAS_GROUP_IDENTITIES)
 * The irreversible destroyFrozen path stays behind an explicit manual flag
 * even when write flows are added.
 */
test.describe("Pending (read-only)", () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole("button", { name: "Pending", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Pending group actions" }),
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
