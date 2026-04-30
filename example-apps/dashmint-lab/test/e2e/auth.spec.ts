import { test, expect, HAS_MNEMONIC, loginViaModal } from "./fixtures";

test.describe("Authenticated flows (auth-gated)", () => {
  // Login modifies session state; keep this describe serial so it can't race
  // against any future write-tier specs sharing the same identity.
  test.describe.configure({ mode: "serial" });

  test.skip(
    !HAS_MNEMONIC,
    "PLATFORM_MNEMONIC not set — skipping auth-gated specs",
  );

  test("TransferModal recipient hints update the submit state", async ({
    page,
  }) => {
    await loginViaModal(page);

    await page.getByRole("button", { name: "Yours" }).click();
    await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

    const cards = page.locator("article");
    if ((await cards.count()) === 0) {
      test.skip(
        true,
        "Signed-in identity owns no cards; cannot open Transfer modal.",
      );
    }

    const dpnsHandle = await page
      .locator("aside")
      .getByText(/^@\w+/)
      .first()
      .textContent();
    const knownName = dpnsHandle?.replace(/^@/, "").trim();

    const firstCard = cards.first();
    await firstCard.getByRole("button", { name: /more actions/i }).click();
    await firstCard.getByRole("button", { name: /^transfer$/i }).click();

    const dialog = page.getByRole("dialog", { name: /transfer card/i });
    await expect(dialog).toBeVisible();

    const input = dialog.getByPlaceholder("alice.dash or identity ID");
    const submit = dialog.getByRole("button", { name: /^Transfer$/ });

    // Invalid characters → red hint, submit disabled.
    await input.fill("abc!@#");
    await expect(
      dialog.getByText(/letters, digits, and hyphens only/i),
    ).toBeVisible();
    await expect(submit).toBeDisabled();

    // Name that resolves to nothing → "no identity found" hint, still disabled.
    await input.fill("definitely-not-a-real-name-9876543210.dash");
    await expect(dialog.getByText(/no identity found/i)).toBeVisible({
      timeout: 30_000,
    });
    await expect(submit).toBeDisabled();

    if (knownName) {
      // Real DPNS name → ✓ confirmation, submit enabled.
      await input.fill(`${knownName}.dash`);
      await expect(dialog.getByText(/✓/)).toBeVisible({ timeout: 30_000 });
      await expect(submit).toBeEnabled();
    }

    await dialog.getByRole("button", { name: /^Cancel$/ }).click();
    await expect(dialog).toBeHidden();
  });
});
