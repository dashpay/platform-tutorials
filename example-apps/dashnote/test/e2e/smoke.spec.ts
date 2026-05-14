import { test, expect, navButton } from "./fixtures";

// All read-only flows. No mnemonic required; no testnet writes.
// Runs under both chromium-desktop and chromium-mobile projects.

test.describe("boot", () => {
  test("SDK connects and the IdentityCard reports a live connection", async ({
    page,
  }) => {
    // The base fixture already waits for the readonly subtitle to paint
    // "Connected". This test re-asserts that signal so failures here
    // flag a regression in the connection gate itself.
    await expect(
      page
        .locator('aside[aria-label="Main navigation"]')
        .getByText("Connected", { exact: true }),
    ).toBeVisible();
  });

  test("page title is Dashnote", async ({ page }) => {
    await expect(page).toHaveTitle(/Dashnote/i);
  });
});

test.describe("tab navigation", () => {
  test("switches between Notes and How it works", async ({ page }) => {
    // Notes tab is the default.
    await expect(
      page.getByRole("heading", {
        name: /personal notes, stored on a public blockchain/i,
      }),
    ).toBeVisible();

    await (await navButton(page, /how it works/i)).click();
    await expect(
      page.getByRole("heading", { name: /walkthrough of every sdk call/i }),
    ).toBeVisible();

    await (await navButton(page, /notes$/i)).click();
    await expect(
      page.getByRole("heading", {
        name: /personal notes, stored on a public blockchain/i,
      }),
    ).toBeVisible();
  });
});

test.describe("theme toggle", () => {
  test("toggling the theme switches the html data-theme attribute", async ({
    page,
  }) => {
    const html = page.locator("html");
    const before = await html.getAttribute("data-theme");
    // The toggle is rendered both in the mobile top bar and in the sidebar.
    // On desktop only the sidebar one is visible; on mobile only the top-bar
    // one is visible at rest. `.first()` resolves to whichever is in DOM.
    await page
      .getByRole("button", { name: /switch to (light|dark) theme/i })
      .first()
      .click();
    await expect
      .poll(async () => html.getAttribute("data-theme"))
      .not.toBe(before);
  });
});

test.describe("login modal", () => {
  test("sidebar Sign in button opens the modal", async ({ page }) => {
    await (await navButton(page, /sign in$/i)).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder(/mnemonic phrase|wif/i)).toBeVisible();
  });

  test("Cancel button closes the modal", async ({ page }) => {
    await (await navButton(page, /sign in$/i)).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /^cancel$/i }).click();
    await expect(dialog).toBeHidden();
  });

  test("Escape closes the modal", async ({ page }) => {
    await (await navButton(page, /sign in$/i)).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("Sign in button is disabled until a secret is entered", async ({
    page,
  }) => {
    await (await navButton(page, /sign in$/i)).click();
    const dialog = page.getByRole("dialog");
    const submit = dialog.getByRole("button", { name: /^Sign in$/ });
    await expect(submit).toBeDisabled();
    await dialog.getByPlaceholder(/mnemonic phrase|wif/i).fill("abandon");
    await expect(submit).toBeEnabled();
  });

  test("Advanced settings reveals the identity-index field for mnemonic input", async ({
    page,
  }) => {
    await (await navButton(page, /sign in$/i)).click();
    const dialog = page.getByRole("dialog");
    // Type something with whitespace so detectSecretShape() picks "mnemonic"
    // and the identity-index field is rendered inside Advanced.
    await dialog.getByPlaceholder(/mnemonic phrase|wif/i).fill("word word");
    await dialog.getByRole("button", { name: /advanced settings/i }).click();
    await expect(dialog.getByText(/identity index/i)).toBeVisible();
    await expect(dialog.locator('input[type="number"]')).toBeVisible();
  });

  test("Advanced settings disclosure is hidden when input parses as a WIF", async ({
    page,
  }) => {
    // WIF input has no DIP-13 derivation, so identity-index is irrelevant
    // and the whole Advanced disclosure should disappear.
    await (await navButton(page, /sign in$/i)).click();
    const dialog = page.getByRole("dialog");

    // Mnemonic-shaped input first → disclosure renders.
    await dialog.getByPlaceholder(/mnemonic phrase|wif/i).fill("word word");
    await expect(
      dialog.getByRole("button", { name: /advanced settings/i }),
    ).toBeVisible();

    // Switch to WIF-shaped input → disclosure disappears.
    await dialog
      .getByPlaceholder(/mnemonic phrase|wif/i)
      .fill("cVHcfvcWNc7DvqaPCwM6Z3DqZ");
    await expect(
      dialog.getByRole("button", { name: /advanced settings/i }),
    ).toBeHidden();
  });
});

test.describe("mobile drawer", () => {
  test("hamburger opens the sidebar drawer and tapping a nav button closes it", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-mobile",
      "mobile-only viewport behavior",
    );

    const hamburger = page.locator(
      'button[aria-expanded][aria-label*="menu" i]',
    );
    const aside = page.locator('aside[aria-label="Main navigation"]');

    // Drawer starts closed on mobile.
    await expect(hamburger).toHaveAttribute("aria-expanded", "false");

    await hamburger.click();
    await expect(hamburger).toHaveAttribute("aria-expanded", "true");

    await aside.getByRole("button", { name: /how it works/i }).click();
    // NavButton's onClick calls closeDrawer().
    await expect(hamburger).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("lite HTML", () => {
  test("dashnote-lite.html loads with a Dashnote heading", async ({ page }) => {
    await page.goto("/dashnote-lite.html");
    await expect(page).toHaveTitle(/DashNote Lite/i);
  });
});
