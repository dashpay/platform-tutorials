import { test, expect, HAS_MNEMONIC, loginViaModal } from "./fixtures";

test.describe("Authenticated flows (auth-gated)", () => {
  // Login modifies session state; keep this describe serial so it can't race
  // against any future write-tier specs sharing the same identity.
  test.describe.configure({ mode: "serial" });

  test.skip(
    !HAS_MNEMONIC,
    "PLATFORM_MNEMONIC not set — skipping auth-gated specs",
  );

  // ─── After-login UI states ────────────────────────────────────────────────

  test("Yours tab becomes visible and IdentityCard exposes identity details", async ({
    page,
  }) => {
    await loginViaModal(page);

    await expect(page.getByRole("button", { name: "Yours" })).toBeVisible();

    const aside = page.locator("aside");
    // DPNS reverse-lookup is async; wait up to 30s for the @username chip.
    await expect(aside.getByText(/^@\w+/).first()).toBeVisible({
      timeout: 30_000,
    });
    // truncateId(id, 6) → "<6chars>…<6chars>" in base58.
    await expect(
      aside.getByText(/[1-9A-HJ-NP-Za-km-z]{6}…[1-9A-HJ-NP-Za-km-z]{6}/),
    ).toBeVisible();
  });

  test("Mint tab no longer shows the unauthenticated overlay", async ({
    page,
  }) => {
    await loginViaModal(page);

    await page
      .getByRole("navigation")
      .getByRole("button", { name: /mint/i })
      .click();
    // The unauthenticated overlay is gone. (A different overlay may appear
    // for non-contract-owners; we only assert the *unauth* one is hidden.)
    await expect(
      page.getByText(/login as contract owner to access this feature/i),
    ).toBeHidden();
  });

  // ─── Modal smokes (open / inspect / cancel) ───────────────────────────────

  test("TransferModal mounts cleanly with card summary and recipient input", async ({
    page,
  }) => {
    await loginViaModal(page);

    await page.getByRole("button", { name: "Yours" }).click();
    await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

    const cards = page.locator("article");
    if ((await cards.count()) === 0) {
      test.skip(true, "Signed-in identity owns no cards.");
    }

    const firstCard = cards.first();
    await firstCard.getByRole("button", { name: /more actions/i }).click();
    await firstCard.getByRole("button", { name: /^transfer$/i }).click();

    const dialog = page.getByRole("dialog", { name: /transfer card/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("h3")).toBeVisible(); // card title
    await expect(
      dialog.getByPlaceholder("alice.dash or identity ID"),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^Transfer$/ })).toBeVisible();

    await dialog.getByRole("button", { name: /^Cancel$/ }).click();
    await expect(dialog).toBeHidden();
  });

  test("PurchaseModal opens for a marketplace listing owned by someone else", async ({
    page,
  }) => {
    await loginViaModal(page);

    // Read the truncated identity id from the IdentityCard so we can skip
    // self-listings.
    const myIdSnippet = await page
      .locator("aside")
      .getByText(/[1-9A-HJ-NP-Za-km-z]{6}…[1-9A-HJ-NP-Za-km-z]{6}/)
      .first()
      .textContent();
    const myPrefix = myIdSnippet?.split("…")[0]?.trim();

    await page.getByRole("button", { name: "Marketplace" }).click();
    await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

    const cards = page.locator("article");
    const count = await cards.count();
    if (count === 0) {
      test.skip(true, "Marketplace is empty.");
    }

    let target = -1;
    for (let i = 0; i < count; i += 1) {
      const text = await cards.nth(i).innerText();
      if (!myPrefix || !text.includes(myPrefix)) {
        target = i;
        break;
      }
    }
    if (target === -1) {
      test.skip(true, "All marketplace listings are owned by the test identity.");
    }

    const card = cards.nth(target);
    await card.getByRole("button", { name: /^buy$/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("h3")).toBeVisible(); // card title
    await expect(dialog.getByText(/\d[\d,]*\s*(cr|credits)/i).first()).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^Buy/ })).toBeVisible();

    await dialog.getByRole("button", { name: /^Cancel$/ }).click();
    await expect(dialog).toBeHidden();
  });

  test("BurnModal first click flips to confirm without burning the card", async ({
    page,
  }) => {
    await loginViaModal(page);

    await page.getByRole("button", { name: "Yours" }).click();
    await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

    const cards = page.locator("article");
    if ((await cards.count()) === 0) {
      test.skip(true, "Signed-in identity owns no cards.");
    }

    const firstCard = cards.first();
    const cardTitle = (await firstCard.locator("h3").first().textContent())?.trim();
    expect(cardTitle).toBeTruthy();
    const countBefore = await cards.count();

    await firstCard.getByRole("button", { name: /more actions/i }).click();
    await firstCard.getByRole("button", { name: /burn card/i }).click();

    const dialog = page.getByRole("dialog", { name: /burn card/i });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/this will permanently destroy the card/i),
    ).toBeVisible();

    // First click is a pure UI flip — setConfirmed(true). No SDK call.
    await dialog.getByRole("button", { name: /^Burn Card$/ }).click();

    await expect(
      dialog.getByRole("button", { name: /^Confirm Burn$/ }),
    ).toBeVisible();
    await expect(
      dialog.getByText(/are you sure\? this action is permanent/i),
    ).toBeVisible();
    // Success notice must NOT appear — that would mean delete actually ran.
    await expect(dialog.getByText(/card burned successfully/i)).toBeHidden();
    // Modal stays open.
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: /^Cancel$/ }).click();
    await expect(dialog).toBeHidden();

    // Grid count must be unchanged — if delete had fired, the card would be
    // gone after the next refetch and the count would drop by one. Title
    // alone is unreliable since multiple cards can share a starter-pool name.
    await expect(cards).toHaveCount(countBefore);
    await expect(
      page.locator("article", { hasText: cardTitle ?? "" }).first(),
    ).toBeVisible();
  });

  // ─── SetPrice round-trip (write-tier, reversible) ─────────────────────────

  // This is the only auth-gated spec that mutates chain state. Listing,
  // updating price, and unlisting are free document-state mutations on the
  // seller's own card — no funds move. If this test crashes between "List"
  // and "Unlist", a leftover listing is harmless: the next run picks the
  // first *unlisted* card.
  test("SetPrice round-trip: list → update → unlist", async ({ page }) => {
    test.setTimeout(300_000);
    await loginViaModal(page);

    await page.getByRole("button", { name: "Yours" }).click();
    await expect(page.getByText(/loading…/i)).toBeHidden({ timeout: 90_000 });

    const cards = page.locator("article");
    const count = await cards.count();
    if (count === 0) {
      test.skip(true, "Signed-in identity owns no cards.");
    }

    // Pick the first card with a "Sell" button (i.e. unlisted).
    let chosenIndex = -1;
    for (let i = 0; i < count; i += 1) {
      const sellBtn = cards.nth(i).getByRole("button", { name: /^sell$/i });
      if (await sellBtn.isVisible().catch(() => false)) {
        chosenIndex = i;
        break;
      }
    }
    if (chosenIndex === -1) {
      test.skip(true, "All owned cards are already listed.");
    }

    const card = cards.nth(chosenIndex);
    const title = (await card.locator("h3").first().textContent())?.trim();
    expect(title).toBeTruthy();
    const cardByTitle = page.locator("article", { hasText: title ?? "" }).first();

    // ── Step 1: List for sale ───────────────────────────────────────────────
    await card.getByRole("button", { name: /^sell$/i }).click();
    let dialog = page.getByRole("dialog", { name: /^set price$/i });
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder("Enter price (credits)").fill("12345");
    await dialog.getByRole("button", { name: /^List for sale$/ }).click();
    // Dialog auto-closes ~700ms after success. Treat its disappearance as
    // the success signal — if setPrice had thrown, the modal stays open
    // with an error notice. Allow generous time for the chain round-trip.
    await expect(dialog).toBeHidden({ timeout: 90_000 });

    // ── Verify listed ───────────────────────────────────────────────────────
    await expect(cardByTitle.getByText(/12,345\s*cr/)).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      cardByTitle.getByRole("button", { name: /^edit price$/i }),
    ).toBeVisible();

    // ── Step 2: Update price ────────────────────────────────────────────────
    await cardByTitle.getByRole("button", { name: /^edit price$/i }).click();
    dialog = page.getByRole("dialog", { name: /^change price$/i });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/currently listed at 12,345 credits/i),
    ).toBeVisible();
    await dialog.getByPlaceholder("Enter price (credits)").fill("54321");
    await dialog.getByRole("button", { name: /^Update price$/ }).click();
    // Dialog auto-closes ~700ms after success. Treat its disappearance as
    // the success signal — if setPrice had thrown, the modal stays open
    // with an error notice. Allow generous time for the chain round-trip.
    await expect(dialog).toBeHidden({ timeout: 90_000 });

    // ── Verify updated ──────────────────────────────────────────────────────
    await expect(cardByTitle.getByText(/54,321\s*cr/)).toBeVisible({
      timeout: 30_000,
    });

    // ── Step 3: Remove from sale ────────────────────────────────────────────
    await cardByTitle.getByRole("button", { name: /^edit price$/i }).click();
    dialog = page.getByRole("dialog", { name: /^change price$/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /^Remove from sale$/ }).click();
    await expect(dialog).toBeHidden({ timeout: 90_000 });

    // ── Verify unlisted ─────────────────────────────────────────────────────
    await expect(
      cardByTitle.getByRole("button", { name: /^sell$/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(cardByTitle.getByText(/\bcr\b/)).toBeHidden();

    // Re-open the modal to confirm both surfaces (chip + modal) agree the
    // card is unlisted: the "Set price" variant should render with no
    // "Currently listed at …" anchor line.
    await cardByTitle.getByRole("button", { name: /^sell$/i }).click();
    const reopened = page.getByRole("dialog", { name: /^set price$/i });
    await expect(reopened).toBeVisible();
    await expect(reopened.getByText(/currently listed at/i)).toBeHidden();
    await reopened.getByRole("button", { name: /^Cancel$/ }).click();
    await expect(reopened).toBeHidden();
  });

  // ─── Existing recipient-validation spec ───────────────────────────────────

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
