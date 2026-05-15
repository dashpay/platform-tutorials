import {
  test,
  expect,
  HAS_MNEMONIC,
  loginViaModal,
  createNoteViaEditor,
  deleteNoteByTitle,
  cleanupE2eNotes,
  returnToList,
  seedSearchFixtures,
  e2eTitle,
  SEARCH_FIXTURE_ALPHA,
  SEARCH_FIXTURE_BETA,
} from "./fixtures";

test.skip(!HAS_MNEMONIC, "PLATFORM_MNEMONIC not set — skipping notes specs");
test.describe.configure({ mode: "serial" });

// Login once per worker. Each test cleans up its own [e2e]-prefixed notes
// in afterEach so a failure doesn't cascade into the next test.
test.beforeEach(async ({ page }) => {
  await page.evaluate(() => {
    try {
      window.localStorage.removeItem("dashnote.lastIdentity");
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
  await loginViaModal(page);
});

test.afterEach(async ({ page }) => {
  // Defensive cleanup — only touches notes with the e2e title prefix so a
  // hand-created note on the same identity stays put.
  await cleanupE2eNotes(page).catch(() => {
    /* best effort */
  });
});

test("create, edit, and delete a note round-trip", async ({ page }) => {
  const originalTitle = e2eTitle("create");
  await createNoteViaEditor(page, {
    title: originalTitle,
    message: "Body text written by the e2e suite.",
  });

  // Reopen and edit. createNoteViaEditor leaves the editor open on the
  // new note — on mobile that means the list is hidden, so hop back to
  // it before clicking the item. (No-op on desktop.)
  await returnToList(page);
  const newTitle = e2eTitle("edit");
  await page.locator("button", { hasText: originalTitle }).first().click();
  await expect(page.getByLabel("Title")).toHaveValue(originalTitle);
  await page.getByLabel("Title").fill(newTitle);
  await page.getByRole("button", { name: /^save$/i }).click();
  // Save completes when the button disables again (dirty=false).
  await expect(page.getByRole("button", { name: /^save$/i })).toBeDisabled();

  // After save, hop back to the list to verify the title change is
  // reflected there (and the old title is gone).
  await returnToList(page);
  await expect(
    page.locator("button", { hasText: newTitle }).first(),
  ).toBeVisible();
  await expect(page.locator("button", { hasText: originalTitle })).toHaveCount(
    0,
  );

  await deleteNoteByTitle(page, newTitle);
});

test("search filter narrows the list to matching notes", async ({ page }) => {
  // Reuse the two persistent search fixtures instead of writing fresh
  // notes every run. They survive cleanup because their prefix is
  // `[e2e-fixture]`, not `[e2e]`.
  await seedSearchFixtures(page);
  // Seeding may leave the editor open (mobile hides the list when a note
  // is selected); return to the list view so the Search input is shown.
  await returnToList(page);

  const search = page.getByPlaceholder("Search");
  await search.fill("alpha");
  await expect(
    page.locator("button", { hasText: SEARCH_FIXTURE_ALPHA }).first(),
  ).toBeVisible();
  await expect(
    page.locator("button", { hasText: SEARCH_FIXTURE_BETA }),
  ).toHaveCount(0);

  // Clearing the search restores both.
  await search.fill("");
  await expect(
    page.locator("button", { hasText: SEARCH_FIXTURE_BETA }).first(),
  ).toBeVisible();
});

test("discard-changes confirmation cancels the navigation when dismissed", async ({
  page,
}) => {
  const title = e2eTitle("discard");
  await createNoteViaEditor(page, {
    title,
    message: "original body",
  });

  // Open the note, dirty it, then try to start a NEW draft. The discard
  // confirm() should fire — dismiss it and verify we stayed on the note.
  // createNoteViaEditor leaves the editor open; on mobile we'd need to
  // go back to the list to reach the item, but the editor is already
  // showing this note so just verify the title input is populated.
  await returnToList(page);
  await page.locator("button", { hasText: title }).first().click();
  await expect(page.getByLabel("Title")).toHaveValue(title);
  await page.getByLabel("Body").fill("dirty edit waiting to be discarded");

  page.once("dialog", (dialog) => {
    expect(dialog.message()).toMatch(/discard unsaved changes/i);
    void dialog.dismiss();
  });

  // Trigger a navigation that runs confirmDiscard(). On desktop the
  // "New note" button is always visible and calls handleNew(). On mobile
  // the FAB lives inside the (hidden) list pane, so use "Back to notes"
  // instead — handleBack() calls the same confirmDiscard() guard.
  const viewport = page.viewportSize();
  const isMobile = viewport != null && viewport.width < 768;
  if (isMobile) {
    await page.getByRole("button", { name: /back to notes/i }).click();
  } else {
    await page.getByRole("button", { name: /^new note$/i }).click();
  }

  // The note we were editing is still selected, body is still dirty.
  await expect(page.getByLabel("Title")).toHaveValue(title);
  await expect(page.getByLabel("Body")).toHaveValue(
    "dirty edit waiting to be discarded",
  );

  // Reset the dirty state so afterEach's cleanupE2eNotes can navigate
  // around without tripping another discard prompt. Restoring the body
  // to the original value makes `dirty === false` again.
  await page.getByLabel("Body").fill("original body");
});

test("mobile: tapping a note transitions list → editor; Back returns", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-mobile",
    "mobile-only viewport behavior",
  );

  const title = e2eTitle("mobile");
  await createNoteViaEditor(page, {
    title,
    message: "mobile list/editor transition",
  });

  // Returning to the list view: after createNoteViaEditor, the editor is
  // showing the new note. Hit Back.
  await page.getByRole("button", { name: /back to notes/i }).click();
  // List visible again, editor hidden.
  await expect(page.getByPlaceholder("Search")).toBeVisible();
  await expect(page.getByLabel("Title")).toBeHidden();

  // Tap the note → editor reappears.
  await page.locator("button", { hasText: title }).first().click();
  await expect(page.getByLabel("Title")).toHaveValue(title);
  // Search bar is hidden once a note is selected on mobile.
  await expect(page.getByPlaceholder("Search")).toBeHidden();
});

test("two contexts can sequentially save the same note without conflict", async ({
  browser,
}) => {
  // This test does ~6 testnet round-trips (login×2, create, update×2,
  // delete) across two browser contexts. The default 15s test budget
  // isn't enough.
  test.setTimeout(60_000);

  // Spin up two contexts that share the same identity. Login with
  // rememberMe so reloads keep the identity hint and re-enter "browsing"
  // mode — without that, reload would drop both pages to readonly and
  // hide the note list behind a sign-in prompt.
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();

  try {
    for (const p of [page1, page2]) {
      await p.goto("/");
      await expect(
        p
          .locator('aside[aria-label="Main navigation"]')
          .getByText("Connected", { exact: true }),
      ).toBeVisible({ timeout: 60_000 });
      await loginViaModal(p, { rememberMe: true });
    }

    const title = e2eTitle("twoctx");
    await createNoteViaEditor(page1, {
      title,
      message: "round 1 (from page1)",
    });

    // Page2 needs to see the note created by page1. Reload to bypass
    // the 30s background refresh and re-login (rememberMe means the
    // login form pre-fills with the remembered identity hint). A
    // remembered identity boots into browsing, so wait for that
    // subtitle as the readiness gate.
    await page2.reload();
    await expect(
      page2
        .locator('aside[aria-label="Main navigation"]')
        .getByText("Read-only access", { exact: true }),
    ).toBeVisible({ timeout: 60_000 });
    await loginViaModal(page2, { rememberMe: true });
    await expect(
      page2.locator("button", { hasText: title }).first(),
    ).toBeVisible({ timeout: 60_000 });

    // Page2 edits + saves. updateNote.ts fetches the current revision
    // first and bumps by 1, so this should succeed even if page1 saves
    // again after.
    await page2.locator("button", { hasText: title }).first().click();
    await expect(page2.getByLabel("Title")).toHaveValue(title, {
      timeout: 30_000,
    });
    await page2.getByLabel("Body").fill("round 2 (from page2)");
    await page2.getByRole("button", { name: /^save$/i }).click();
    await expect(page2.getByRole("button", { name: /^save$/i })).toBeDisabled({
      timeout: 60_000,
    });

    // Page1 reloads + re-logs to see page2's edit, then makes its own
    // change. Remembered identity → browsing on reload, so wait for
    // the browsing subtitle as the readiness gate.
    await page1.reload();
    await expect(
      page1
        .locator('aside[aria-label="Main navigation"]')
        .getByText("Read-only access", { exact: true }),
    ).toBeVisible({ timeout: 60_000 });
    await loginViaModal(page1, { rememberMe: true });
    await page1.locator("button", { hasText: title }).first().click();
    await expect(page1.getByLabel("Body")).toHaveValue("round 2 (from page2)", {
      timeout: 30_000,
    });
    await page1.getByLabel("Body").fill("round 3 (from page1)");
    await page1.getByRole("button", { name: /^save$/i }).click();
    await expect(page1.getByRole("button", { name: /^save$/i })).toBeDisabled({
      timeout: 60_000,
    });

    // Cleanup from page1. afterEach runs against the base test `page`,
    // which is a different context that isn't logged in, so cleanup has
    // to happen here while we still have an authenticated context.
    await deleteNoteByTitle(page1, title);
    await cleanupE2eNotes(page1).catch(() => {
      /* best effort */
    });
  } finally {
    await ctx1.close();
    await ctx2.close();
  }
});

test("activity panel opens via ⌘L, lists entries, clears, and closes via Escape", async ({
  page,
}) => {
  // Login alone produces several info-level log entries
  // (SessionContext.tsx logs "Connecting…", "Connected…", "Identity resolved",
  // etc.), so we don't need to save a note before opening the panel.
  await page.keyboard.press("Meta+l");
  const dialog = page.getByRole("dialog", { name: /activity log/i });
  await expect(dialog).toBeVisible();

  // At least one log entry should be visible.
  await expect(
    dialog.getByText(/connected to dash platform testnet/i).first(),
  ).toBeVisible({ timeout: 10_000 });

  // Clear empties the log and renders the empty-state copy.
  await dialog.getByRole("button", { name: /^clear$/i }).click();
  await expect(dialog.getByText(/no activity yet/i)).toBeVisible();

  // Escape detaches the dialog.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
