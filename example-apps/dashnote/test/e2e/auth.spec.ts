import {
  test,
  expect,
  HAS_MNEMONIC,
  loginViaModal,
  navButton,
  openIdentityMenu,
  openSettingsTab,
} from "./fixtures";

test.skip(!HAS_MNEMONIC, "PLATFORM_MNEMONIC not set — skipping auth specs");
test.describe.configure({ mode: "serial" });

// Each test starts from a clean session: no remembered identity, no
// contract override. The base `page` fixture in fixtures.ts already
// waits for the SDK to connect on `/`, so the IdentityCard renders
// "Guest" (readonly) by default with the subtitle "Connected".
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
  await expect(
    page
      .locator('aside[aria-label="Main navigation"]')
      .getByText("Connected", { exact: true }),
  ).toBeVisible({ timeout: 60_000 });
});

test("login with a mnemonic, then logout via the IdentityCard menu", async ({
  page,
}) => {
  await loginViaModal(page);

  await openIdentityMenu(page);
  await page.getByRole("menuitem", { name: /^log out$/i }).click();

  // No remembered identity → session drops back to readonly. The
  // readonly IdentityCard paints "Guest" as the eyebrow and "Connected"
  // as the subtitle.
  await expect(
    page
      .locator('aside[aria-label="Main navigation"]')
      .getByText("Guest", { exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page
      .locator('aside[aria-label="Main navigation"]')
      .getByText("Connected", { exact: true }),
  ).toBeVisible();
});

test("remember-me persists the identity hint across reloads", async ({
  page,
}) => {
  await loginViaModal(page, { rememberMe: true });

  await page.reload();
  // A fresh load drops the keyManager, so the remembered identity boots
  // into "browsing" (signed-out with identity hint) rather than
  // authenticated. The IdentityCard renders the "Read-only access"
  // subtitle under a "Signed out" eyebrow.
  await expect(
    page
      .locator('aside[aria-label="Main navigation"]')
      .getByText("Read-only access", { exact: true }),
  ).toBeVisible({ timeout: 30_000 });
});

test("forget-this-device via the Settings panel drops back to readonly", async ({
  page,
}) => {
  await loginViaModal(page, { rememberMe: true });

  await openSettingsTab(page);
  // "Danger zone" Section only renders when rememberedIdentityId is set.
  await page.getByRole("button", { name: /forget this device/i }).click();

  // After forgetting, this session stays authenticated; the localStorage
  // hint is gone, so a reload drops to readonly (not browsing).
  await page.reload();
  await expect(
    page
      .locator('aside[aria-label="Main navigation"]')
      .getByText("Connected", { exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page
      .locator('aside[aria-label="Main navigation"]')
      .getByText("Read-only access", { exact: true }),
  ).toBeHidden();
});

test("Switch identity from the IdentityCard menu re-opens the login form", async ({
  page,
}) => {
  await loginViaModal(page);

  await openIdentityMenu(page);
  await page.getByRole("menuitem", { name: /switch identity/i }).click();

  // The LoginModal opens with the same form layout regardless of session
  // state. Verify it's open and ready to accept a new secret.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByPlaceholder(/mnemonic phrase|wif/i)).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /^Sign in$/ }),
  ).toBeDisabled();
});

test("Settings tab is reachable from both the IdentityCard menu and the sidebar NavButton", async ({
  page,
}) => {
  await loginViaModal(page);

  // Menu path.
  await openSettingsTab(page);

  // Sidebar NavButton path — switch away first, then back. navButton
  // handles the mobile drawer open dance.
  await (await navButton(page, /how it works/i)).click();
  await expect(
    page.getByRole("heading", { name: /walkthrough of every sdk call/i }),
  ).toBeVisible();

  await (await navButton(page, /settings$/i)).click();
  await expect(
    page.getByRole("heading", { name: /^Settings$/, level: 1 }),
  ).toBeVisible();
});

test("Settings panel displays the identity ID once authenticated", async ({
  page,
}) => {
  await loginViaModal(page);
  await openSettingsTab(page);

  const idBlock = page.locator('[data-testid="settings-identity-block"]');
  // Identity IDs are base58 strings ~44 chars long; require something
  // substantial rather than the loading placeholder.
  await expect(idBlock).toContainText(/[0-9A-Za-z]{40,}/);
});
