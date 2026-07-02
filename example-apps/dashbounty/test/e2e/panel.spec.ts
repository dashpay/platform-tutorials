import {
  test,
  expect,
  HAS_PANEL_IDENTITIES,
  PANELIST_IDS,
  loginAs,
} from "./fixtures";

// The only spec that exercises the group 2-of-3 propose/co-sign flow for
// real. Requires 4 distinct on-chain identities (see
// scripts/bootstrap-identities.mjs) — a genuinely different signing
// identity for the second signature, not the same key re-signing. Gated
// behind HAS_PANEL_IDENTITIES rather than HAS_MNEMONIC so casual
// contributors/CI aren't blocked by the heavier 4-identity setup cost.
//
// Freeze → unfreeze round-trip on panelist 2's own identity, ending back at
// baseline (unfrozen) — reversible, matching every sibling app's e2e write
// spec philosophy (dashmint-lab's SetPrice list→update→unlist round-trip).
// Destroy (an irreversible slash) is deliberately excluded from automated
// e2e for the same reason marketplace/burn writes are excluded elsewhere.
test.describe("Triage Panel group signing (2-of-3, auth-gated)", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    !HAS_PANEL_IDENTITIES,
    "VITE_PANELIST_1_ID/_2_ID/_3_ID not set — skipping group-signing specs",
  );

  test.setTimeout(300_000);

  test("panelist 1 proposes a freeze, panelist 3 co-signs, then unfreezes to restore baseline", async ({
    page,
  }) => {
    const [, target] = PANELIST_IDS; // panelist 2's identity is the freeze target

    // ── Step 1: panelist 1 proposes a freeze on panelist 2 ─────────────────
    await loginAs(page, 1);
    await page.getByRole("button", { name: "Triage panel" }).click();
    await expect(page.getByText(/requires 2 of them to act/)).toBeVisible({
      timeout: 30_000,
    });

    await page.getByLabel("Action").selectOption("freeze");
    await page.getByLabel("Target identity ID").fill(target);
    await page.getByRole("button", { name: "Propose" }).click();
    await expect(page.getByText(/1\/2 power signed/)).toBeVisible({
      timeout: 60_000,
    });

    // ── Step 2: panelist 3 discovers the pending action and co-signs ───────
    await page.getByRole("button", { name: "Account" }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await loginAs(page, 3);
    await page.getByRole("button", { name: "Triage panel" }).click();

    const freezeCard = page
      .locator(".card", { hasText: "Freeze proposal" })
      .first();
    await expect(freezeCard).toBeVisible({ timeout: 30_000 });
    await freezeCard
      .getByPlaceholder("Confirm target identity ID")
      .fill(target);
    await freezeCard.getByRole("button", { name: "Sign" }).click();

    // ── Verify: panelist 2 shows as frozen in the panel member list is not
    // directly exposed, but the pending action disappearing (CLOSED) plus a
    // reports-view "Reporter frozen" badge would confirm it. Simplest
    // reliable signal here: the pending freeze card is gone.
    await expect(freezeCard).toBeHidden({ timeout: 60_000 });

    // ── Step 3: panelist 3 immediately proposes the reversing unfreeze ─────
    await page.getByLabel("Action").selectOption("unfreeze");
    await page.getByLabel("Target identity ID").fill(target);
    await page.getByRole("button", { name: "Propose" }).click();
    await expect(page.getByText(/1\/2 power signed/)).toBeVisible({
      timeout: 60_000,
    });

    // ── Step 4: panelist 1 co-signs the unfreeze, restoring baseline ───────
    await page.getByRole("button", { name: "Account" }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await loginAs(page, 1);
    await page.getByRole("button", { name: "Triage panel" }).click();

    const unfreezeCard = page
      .locator(".card", { hasText: "Unfreeze proposal" })
      .first();
    await expect(unfreezeCard).toBeVisible({ timeout: 30_000 });
    await unfreezeCard
      .getByPlaceholder("Confirm target identity ID")
      .fill(target);
    await unfreezeCard.getByRole("button", { name: "Sign" }).click();
    await expect(unfreezeCard).toBeHidden({ timeout: 60_000 });
  });
});
