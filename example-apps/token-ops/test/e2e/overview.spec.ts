import { test, expect, GROUP_MEMBER_IDS } from "./fixtures";

/**
 * Dashboard (Overview) view — read-only coverage.
 *
 * Extends the browse smoke test: drives the priority-card navigation, the
 * signed-out states, and the lazy identity-balance inspector (a read). No
 * chain write is performed.
 */
test.describe("Dashboard (read-only)", () => {
  test("priority cards show signed-out states", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Governance at a glance" }),
    ).toBeVisible({ timeout: 60_000 });

    // "Needs your signature" shows an em dash when signed out.
    const attention = page.locator(".dashboard-attention-card", {
      hasText: "Needs your signature",
    });
    await expect(attention.locator("strong")).toHaveText("—");

    // Membership card reports the signed-out state.
    await expect(page.locator(".dashboard-membership-card")).toContainText(
      "Signed out",
    );
  });

  test("priority cards navigate to Pending", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Governance at a glance" }),
    ).toBeVisible({ timeout: 60_000 });

    await page
      .locator(".dashboard-attention-card", { hasText: "Needs your signature" })
      .click();
    await expect(page).toHaveURL(/#pending$/);
    await expect(
      page.getByRole("heading", { name: "Pending group actions" }),
    ).toBeVisible();
  });

  test("'Open governance' navigates to Governance", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Governance at a glance" }),
    ).toBeVisible({ timeout: 60_000 });

    await page.getByRole("button", { name: "Open governance" }).click();
    await expect(page).toHaveURL(/#governance$/);
    await expect(
      page.getByRole("tab", { name: "Access control" }),
    ).toBeVisible();
  });

  test("identity inspector opens and reads a balance", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Governance at a glance" }),
    ).toBeVisible({ timeout: 60_000 });

    const inspector = page.locator("details.dashboard-identity-inspector");
    await expect(inspector).not.toHaveAttribute("open", "");
    await inspector.getByText("Check balances").click();
    await expect(inspector).toHaveAttribute("open", "");

    // A live balance read needs a known testnet identity. Use a bootstrapped
    // group-member ID when available; otherwise the form still renders and we
    // skip the live read rather than fail (no data to assert on).
    const [memberId] = GROUP_MEMBER_IDS;
    test.skip(
      !memberId,
      "No VITE_TOKEN_OPS_MEMBER_*_ID set — skipping the live inspect read.",
    );

    await inspector.getByLabel("Identity ID").fill(memberId!);
    await inspector.getByRole("button", { name: "Inspect" }).click();

    // The identity table renders a row for the inspected identity.
    await expect(inspector.locator(".identity-table table")).toBeVisible({
      timeout: 60_000,
    });
    await expect(inspector.locator("tbody tr").first()).toBeVisible();
  });
});
