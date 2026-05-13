import {
  test,
  expect,
  HAS_MNEMONIC,
  loginViaModal,
  navButton,
  openSettingsTab,
} from "./fixtures";

// Readonly-mode test: no mnemonic needed. Runs in its own block so it
// executes regardless of PLATFORM_MNEMONIC.
test.describe("settings (readonly)", () => {
  test("prompts the visitor to sign in before exposing settings", async ({
    page,
  }) => {
    // A previous run may have remembered an identity, which would boot
    // the app into "browsing" mode and hide the sign-in prompt. Clear
    // it and reload so the session lands in readonly.
    await page.evaluate(() => {
      try {
        window.localStorage.removeItem("dashnote.lastIdentity");
      } catch {
        /* localStorage may be unavailable in some contexts */
      }
    });
    await page.reload();
    await expect(page.locator(".conn-dot.connected").first()).toBeVisible({
      timeout: 60_000,
    });

    // In readonly mode the IdentityCard menu trigger is absent, so reach
    // the Settings tab via the sidebar nav button instead.
    await (await navButton(page, /settings$/i)).click();
    await expect(
      page.getByText(/sign in to view and manage/i),
    ).toBeVisible();
  });
});

test.skip(!HAS_MNEMONIC, "PLATFORM_MNEMONIC not set — skipping settings specs");
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await page.evaluate(() => {
    try {
      window.localStorage.removeItem("dashnote.lastIdentity");
      window.localStorage.removeItem("dashnote.contractId");
    } catch {
      /* localStorage may be unavailable in some contexts */
    }
  });
  await page.reload();
  await expect(page.locator(".conn-dot.connected").first()).toBeVisible({
    timeout: 60_000,
  });
  await loginViaModal(page);
});

test("Copy identity ID writes the displayed value to the clipboard", async ({
  page,
}) => {
  await openSettingsTab(page);

  // Wait for the identity block to populate (placeholder is "—"). The
  // value sits in a font-mono div alongside a Copy button; reading the
  // block's full textContent would include the button label, so target
  // the mono div directly.
  const idBlock = page.locator('[data-testid="settings-identity-block"]');
  const idValue = idBlock.locator("div.font-mono").first();
  await expect(idValue).toHaveText(/[0-9A-Za-z]{40,}/);
  const identityId = ((await idValue.textContent()) ?? "").trim();

  await page.getByRole("button", { name: /copy identity id/i }).click();
  // Label flips to "Copied!" briefly.
  await expect(
    page.getByRole("button", { name: /copy identity id/i }),
  ).toContainText(/copied/i);

  const clipped = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipped).toBe(identityId);
});

test("Copy contract ID writes the current contract ID to the clipboard", async ({
  page,
}) => {
  await openSettingsTab(page);

  // The contract input is pre-populated with the current contractId.
  const contractInput = page.getByPlaceholder(/note contract id/i);
  await expect(contractInput).not.toHaveValue("");
  const contractId = await contractInput.inputValue();

  await page.getByRole("button", { name: /copy contract id/i }).click();
  await expect(
    page.getByRole("button", { name: /copy contract id/i }),
  ).toContainText(/copied/i);

  const clipped = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipped).toBe(contractId);
});

test("Clear local cache flips the button label and removes the cached entry", async ({
  page,
}) => {
  await openSettingsTab(page);

  // Discover the localStorage cache key. The notes cache is keyed by
  // `dashnote.notes.<identity>.<contract>.testnet` (see lib/notesCache).
  // Seed it directly so we can assert the clear works without depending
  // on whether the notes list has been opened in this session.
  const idBlock = page.locator('[data-testid="settings-identity-block"]');
  const idValue = idBlock.locator("div.font-mono").first();
  await expect(idValue).toHaveText(/[0-9A-Za-z]{40,}/);
  const identityId = ((await idValue.textContent()) ?? "").trim();
  const contractId = await page
    .getByPlaceholder(/note contract id/i)
    .inputValue();
  const cacheKeyPrefix = `dashnote.notes.${identityId}.${contractId}`;

  // Plant a fake cache entry so we have something concrete to assert
  // was removed. clearCachedNotes(identityId) is identity-scoped so any
  // contract-suffixed key under that identity should be wiped.
  await page.evaluate((key) => {
    window.localStorage.setItem(`${key}.testnet`, '{"notes":[]}');
  }, cacheKeyPrefix);

  await page
    .getByRole("button", { name: /clear local cache for this device/i })
    .click();
  // Label transitions to "Cache cleared" for ~2s.
  await expect(
    page.getByRole("button", { name: /cache cleared/i }),
  ).toBeVisible();

  const remaining = await page.evaluate(
    (key) => window.localStorage.getItem(`${key}.testnet`),
    cacheKeyPrefix,
  );
  expect(remaining).toBeNull();
});

test("Use this ID is disabled until the contract input changes", async ({
  page,
}) => {
  await openSettingsTab(page);

  const apply = page.getByRole("button", { name: /^use this id$/i });
  await expect(apply).toBeDisabled();

  // Type a different valid-looking ID — button enables.
  const input = page.getByPlaceholder(/note contract id/i);
  const original = await input.inputValue();
  await input.fill("ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123");
  await expect(apply).toBeEnabled();

  // Restore the original value — button disables again because the
  // trimmed input matches the session contract ID exactly.
  await input.fill(original);
  await expect(apply).toBeDisabled();
});

test("Identity section shows the DPNS name once resolved", async ({ page }) => {
  await openSettingsTab(page);

  // DPNS resolution can take a few seconds after the SDK connects.
  await expect(page.getByText(/✓\s+\S+\.dash/)).toBeVisible({
    timeout: 30_000,
  });
});
