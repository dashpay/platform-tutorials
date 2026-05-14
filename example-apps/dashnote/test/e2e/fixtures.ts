/**
 * Shared Playwright fixtures for dashnote E2E tests.
 *
 * Runs against real Dash Platform testnet — no SDK mocks. The base `page`
 * fixture navigates to `/` and waits for the IdentityCard to paint its
 * readonly subtitle text "Connected" so spec bodies always have a usable
 * SDK. The eyebrow above that subtitle reads "Guest" (not "Connected"),
 * so the subtitle is uniquely identifiable inside the sidebar.
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
    // The readonly IdentityCard renders the text "Connected" as its
    // subtitle once createClient() resolves. The eyebrow above it reads
    // "Guest", so the subtitle is uniquely identifiable inside the
    // sidebar — anchor the boot wait on it.
    await expect(
      page
        .locator('aside[aria-label="Main navigation"]')
        .getByText("Connected", { exact: true }),
    ).toBeVisible({ timeout: 60_000 });
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
 * Resolve a sidebar nav button (Notes / How it works / Sign in) by label.
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
 * Open the IdentityCard menu (the popover with Settings, Switch identity
 * or Sign in, and Log out items). Only available when the session is
 * `authenticated` or `browsing` — caller is responsible for being in that
 * state. The middle entry reads "Switch identity" when authenticated and
 * "Sign in" when browsing read-only.
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
 * Open the LoginModal, fill the mnemonic from PLATFORM_MNEMONIC, submit,
 * and wait for the IdentityCard to report `Full access`.
 *
 * The entry point depends on session state: in `idle/connecting/readonly`
 * the sidebar exposes a "Sign in" NavButton; in `browsing` (remembered
 * identity after reload) the sidebar entry is hidden and the IdentityCard
 * itself opens the modal on click. We detect which surface exists and use
 * whichever one is visible.
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

  const browsing = await page
    .locator('aside[aria-label="Main navigation"]')
    .getByText("Read-only access", { exact: true })
    .isVisible()
    .catch(() => false);

  if (browsing) {
    // In browsing mode the IdentityCard is itself the click target; no
    // menu opens. The card is the only sidebar button containing the
    // "Read-only access" subtitle, so use that as the selector.
    await page
      .locator('aside[aria-label="Main navigation"]')
      .locator("button", { hasText: "Read-only access" })
      .click();
  } else {
    await (await navButton(page, /sign in$/i)).click();
  }

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder(/mnemonic phrase/i).fill(mnemonic);
  const rememberCheckbox = dialog.getByRole("checkbox", {
    name: /remember this identity/i,
  });
  if (!rememberMe) {
    await rememberCheckbox.uncheck();
  }
  await dialog.getByRole("button", { name: /^Sign in$/ }).click();

  await expect(dialog).toBeHidden({ timeout: 60_000 });
  await expect(
    page
      .locator('aside[aria-label="Main navigation"]')
      .getByText("Full access", { exact: true }),
  ).toBeVisible({ timeout: 60_000 });
}

/**
 * Open the Settings panel via the IdentityCard menu's "Settings" item.
 * Caller must already be in an authenticated or browsing session — the
 * IdentityCard menu trigger is only present in those states.
 */
export async function openSettingsTab(page: Page) {
  await openIdentityMenu(page);
  await page.getByRole("menuitem", { name: /^settings$/i }).click();
  await expect(
    page.getByRole("heading", { name: /^Settings$/, level: 1 }),
  ).toBeVisible();
}

/**
 * Recognizable title prefix for every transient note an e2e test creates.
 * The cleanup helper uses this to scope its deletes so it never touches a
 * manually-created note on the same identity.
 *
 * `[e2e-fixture]` titles (a *different* prefix) are reused across runs as
 * deterministic search/list fixtures and are intentionally NOT cleaned up.
 */
export const E2E_TITLE_PREFIX = "[e2e]";
export const E2E_FIXTURE_PREFIX = "[e2e-fixture]";
export const SEARCH_FIXTURE_ALPHA = `${E2E_FIXTURE_PREFIX} alpha`;
export const SEARCH_FIXTURE_BETA = `${E2E_FIXTURE_PREFIX} beta`;

/**
 * Generate a unique e2e-prefixed title.
 */
export function e2eTitle(suffix = ""): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${E2E_TITLE_PREFIX} ${stamp}-${rand}${suffix ? ` ${suffix}` : ""}`;
}

/**
 * Ensure the notes list pane is visible. On desktop the list and editor
 * are always side-by-side, so this is a no-op. On mobile the list is
 * hidden behind `display: none` whenever a note is selected — tapping
 * "Back to notes" returns to the list view.
 */
export async function returnToList(page: Page) {
  if (!isMobile(page)) return;
  const back = page.getByRole("button", { name: /back to notes/i });
  if (await back.isVisible().catch(() => false)) {
    await back.click();
  }
  // List view shows the Search input; wait for it to render.
  await expect(page.getByPlaceholder("Search")).toBeVisible({
    timeout: 30_000,
  });
}

/**
 * Click the "New note" entry point (mobile FAB vs desktop inline button)
 * and wait for the editor to be ready for input.
 */
export async function startNewNote(page: Page) {
  if (isMobile(page)) {
    // The mobile FAB lives inside the NoteList pane, which is hidden
    // whenever a note is selected. Hop back to the list first.
    await returnToList(page);
    await page.getByRole("button", { name: /compose note/i }).click();
  } else {
    await page.getByRole("button", { name: /^new note$/i }).click();
  }
  // Editor pane reveals the Title/Body inputs once selectedId === "new".
  await expect(page.getByLabel("Title")).toBeVisible();
}

/**
 * Create a note via the editor: opens the New-note draft, fills title +
 * body, clicks the create/save button, waits until the list contains an
 * item with the given title.
 */
export async function createNoteViaEditor(
  page: Page,
  { title, message }: { title: string; message: string },
) {
  await startNewNote(page);
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Body").fill(message);
  // The save button reads "Create note" for new drafts.
  await page.getByRole("button", { name: /^create note$/i }).click();
  // Post-save, the editor advances baselines, so the Save button flips
  // from enabled ("Create note") to disabled (label becomes "Save" and
  // dirty=false). That's a viewport-agnostic signal — much more reliable
  // than asserting list-item visibility, which on mobile is hidden
  // because the list pane gets `display: none` when a note is selected.
  await expect(page.getByRole("button", { name: /^save$/i })).toBeDisabled({
    timeout: 60_000,
  });
}

/**
 * Delete a note by title via the UI. Selects the note in the list, hits
 * Delete, and accepts the confirm() prompt automatically. The list
 * background revalidation reflects the deletion within ~60s.
 */
export async function deleteNoteByTitle(page: Page, title: string) {
  // On mobile the list is hidden when a note is selected; surface it
  // first so the target button is clickable.
  await returnToList(page);
  const item = page.locator("button", { hasText: title }).first();
  if (!(await item.isVisible().catch(() => false))) return;
  await item.click();
  // Title input should populate once the detail loads.
  await expect(page.getByLabel("Title")).toHaveValue(title, {
    timeout: 30_000,
  });

  // Desktop renders the "Delete" button in the editor header; mobile
  // renders "Delete note" near the bottom. Match either label.
  await page
    .getByRole("button", { name: /^delete( note)?$/i })
    .first()
    .click();

  // DeleteNoteModal opens for confirmation; scope to its dialog so we
  // don't accidentally re-match the editor's Delete trigger.
  const confirmDialog = page.getByRole("dialog");
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: /^delete$/i }).click();

  // Item leaves the list after reloadNotes resolves.
  await expect(page.locator("button", { hasText: title })).toHaveCount(0, {
    timeout: 60_000,
  });
}

/**
 * Best-effort cleanup: delete every note whose title begins with the
 * transient e2e prefix. The `[e2e-fixture]` deterministic-seed notes
 * are deliberately preserved across runs.
 *
 * Implementation note: list buttons render the title and the message
 * preview as adjacent divs, which `textContent` concatenates without
 * whitespace. Rather than parse that back out, we open each candidate
 * and read the canonical title from the editor's Title input.
 */
export async function cleanupE2eNotes(page: Page) {
  let safety = 20;
  while (safety > 0) {
    safety -= 1;
    // On mobile, if the previous action left the editor open the list pane
    // is `display: none` and candidate lookups would silently return 0.
    // Force the list to be visible before counting.
    await returnToList(page);
    const candidates = page.locator("button", { hasText: E2E_TITLE_PREFIX });
    const total = await candidates.count();
    if (total === 0) return;

    // Iterate the visible list and pick the first non-fixture entry. Open
    // each candidate just long enough to read its canonical title from the
    // editor's Title input; the list buttons render title + preview as
    // concatenated text, which is unreliable to parse.
    let targetTitle: string | null = null;
    for (let i = 0; i < total; i += 1) {
      await candidates.nth(i).click();
      let canonical = "";
      try {
        canonical = await page
          .getByLabel("Title")
          .inputValue({ timeout: 5_000 });
      } catch {
        continue;
      }
      if (
        canonical.startsWith(E2E_TITLE_PREFIX) &&
        !canonical.startsWith(E2E_FIXTURE_PREFIX)
      ) {
        targetTitle = canonical;
        break;
      }
    }
    if (!targetTitle) return;
    await deleteNoteByTitle(page, targetTitle);
  }
}

/**
 * Ensure the two deterministic search fixtures exist for the current
 * identity + contract. Created once and re-used across runs to avoid
 * writing 2 throw-away notes per search test.
 */
export async function seedSearchFixtures(page: Page) {
  // The NoteList renders a `role="status" aria-label="Loading notes"`
  // spinner while the initial query is in flight. Waiting for it to be
  // hidden means either the load resolved or the list already had
  // cached entries — either way, the DOM now reflects truth and an
  // `existing.count() === 0` check won't false-negative against a
  // fixture that exists on-network but hasn't rendered yet.
  await expect(page.getByRole("status", { name: /loading notes/i })).toBeHidden(
    { timeout: 60_000 },
  );
  for (const title of [SEARCH_FIXTURE_ALPHA, SEARCH_FIXTURE_BETA]) {
    const existing = page.locator("button", { hasText: title });
    if ((await existing.count()) > 0) continue;
    await createNoteViaEditor(page, {
      title,
      message: `Deterministic e2e search fixture for "${title}".`,
    });
  }
}
