/**
 * Shared Playwright fixtures for dashnote E2E tests.
 *
 * Runs against real Dash Platform testnet — no SDK mocks. The base `page`
 * fixture navigates to `/` and waits for the IdentityCard's connected dot
 * (`.conn-dot.connected`) to appear so spec bodies always have a usable
 * SDK. We anchor on the dot rather than the text label because the
 * readonly card paints "Connected" twice (eyebrow + status line) which
 * would trip Playwright's strict-mode matchers.
 *
 * The sidebar is rendered as `<aside aria-label="Main navigation">`, not a
 * `<nav>` landmark — scope nav-button lookups through `navButton(page, …)`
 * rather than `page.getByRole("navigation")`.
 *
 * On the mobile project, the sidebar is hidden until the hamburger button
 * is tapped. `navButton` opens the drawer transparently so spec authors
 * don't have to branch on viewport.
 */
import { test as base, expect, type Page } from "@playwright/test";

interface AppFixture {
  page: Page;
}

// Re-export the raw Playwright test so specs that need to manipulate
// localStorage / viewport before navigation can bypass the connection
// pre-condition baked into the default fixture.
export { base as rawTest };

export const test = base.extend<AppFixture>({
  page: async ({ page }, provide) => {
    await page.goto("/");
    // The IdentityCard renders a `<span class="conn-dot connected">` once
    // createClient() resolves, regardless of session.status (readonly /
    // authenticated / browsing). Anchor the wait on the dot itself so we
    // don't have to disambiguate between the duplicated "Connected" /
    // eyebrow labels that the readonly card paints.
    await expect(page.locator(".conn-dot.connected").first()).toBeVisible({
      timeout: 60_000,
    });
    await provide(page);
  },
});

export { expect, type Page };

export const HAS_MNEMONIC = Boolean(process.env.PLATFORM_MNEMONIC?.trim());

function isMobile(page: Page): boolean {
  const size = page.viewportSize();
  return size != null && size.width < 768;
}

/**
 * Resolve a sidebar nav button (Notes / How it works / Login) by label.
 *
 * On mobile the sidebar is off-canvas; this helper opens the hamburger
 * drawer first so the button is in the visible viewport.
 */
export async function navButton(page: Page, label: RegExp | string) {
  if (isMobile(page)) {
    // Hamburger button carries aria-expanded="true|false" reflecting drawerOpen.
    const hamburger = page.locator(
      'button[aria-expanded][aria-label*="menu" i]',
    );
    if ((await hamburger.getAttribute("aria-expanded")) !== "true") {
      await hamburger.click();
      await expect(hamburger).toHaveAttribute("aria-expanded", "true");
    }
  }
  return page
    .locator('aside[aria-label="Main navigation"]')
    .getByRole("button", { name: label });
}

/**
 * Open the IdentityCard menu (the popover with Settings / Switch identity
 * / Log out items). Only available when the session is `authenticated` or
 * `browsing` — caller is responsible for being in that state.
 *
 * On mobile the sidebar is off-canvas; opens the drawer transparently
 * via the hamburger first.
 */
export async function openIdentityMenu(page: Page) {
  if (isMobile(page)) {
    const hamburger = page.locator(
      'button[aria-expanded][aria-label*="menu" i]',
    );
    if ((await hamburger.getAttribute("aria-expanded")) !== "true") {
      await hamburger.click();
      await expect(hamburger).toHaveAttribute("aria-expanded", "true");
    }
  }
  // The IdentityCard menu trigger is the button with aria-haspopup="menu".
  // (The hamburger uses aria-haspopup absent; readonly card is a plain
  // button; only the authenticated/browsing IdentityCard exposes the menu.)
  const trigger = page
    .locator('aside[aria-label="Main navigation"]')
    .locator('button[aria-haspopup="menu"]');
  await trigger.click();
  await expect(page.getByRole("menu")).toBeVisible();
}

/**
 * Open the LoginModal via the sidebar "Login" nav button, fill the
 * mnemonic from PLATFORM_MNEMONIC, submit, and wait for the
 * IdentityCard to report `Authenticated`.
 *
 * Defaults to `rememberMe: false` (the modal's default is true) so tests
 * start from a clean localStorage; opt in explicitly when exercising the
 * remember/forget flow.
 *
 * Caller is responsible for `test.skip(!HAS_MNEMONIC, …)`.
 */
export async function loginViaModal(
  page: Page,
  { rememberMe = false }: { rememberMe?: boolean } = {},
) {
  const mnemonic = process.env.PLATFORM_MNEMONIC?.trim();
  if (!mnemonic) {
    throw new Error("PLATFORM_MNEMONIC is required for loginViaModal");
  }

  await (await navButton(page, /login$/i)).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder(/mnemonic phrase/i).fill(mnemonic);
  const rememberCheckbox = dialog.getByRole("checkbox", {
    name: /remember this identity/i,
  });
  if (!rememberMe) {
    await rememberCheckbox.uncheck();
  }
  await dialog.getByRole("button", { name: /^Login$/ }).click();

  await expect(dialog).toBeHidden({ timeout: 60_000 });
  await expect(page.getByText("Authenticated", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
}
