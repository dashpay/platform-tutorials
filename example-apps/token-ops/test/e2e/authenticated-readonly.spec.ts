import {
  test,
  expect,
  HAS_MNEMONIC,
  loginAs,
  loginWithWif,
  deriveWifFromMnemonic,
} from "./fixtures";

/**
 * Authenticated read-only coverage.
 *
 * Signs in with PLATFORM_MNEMONIC (identity index 0) purely to observe the
 * authenticated read state, then signs out. No chain write is performed — the
 * write flows (propose / co-sign / transfer / register) are deferred to a
 * future pass. Gated on HAS_MNEMONIC so a fresh clone / CI without credentials
 * skips cleanly, matching the sibling-app convention.
 */
test.describe("Authenticated (read-only)", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!HAS_MNEMONIC, "PLATFORM_MNEMONIC not set — skipping auth specs");

  test("sign in reveals authenticated read state, then sign out", async ({
    page,
  }) => {
    await loginAs(page, 0);

    // TopNav flips to signed-in.
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

    // Settings shows the signed-in card.
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Signed in" }),
    ).toBeVisible();

    // Operations eligibility pill flips away from "Read-only".
    await page.getByRole("button", { name: "Operations", exact: true }).click();
    await expect(
      page.locator(".eligibility-pill", { hasText: "Eligibility" }),
    ).toBeVisible({ timeout: 60_000 });

    // Dashboard membership card reflects real standing (no longer "Signed out").
    await page.getByRole("button", { name: "Dashboard", exact: true }).click();
    await expect(page.locator(".dashboard-membership-card")).not.toContainText(
      "Signed out",
      { timeout: 60_000 },
    );

    // Sign out returns to read-only.
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
  });

  test("mnemonic and WIF sign-in resolve to the same identity", async ({
    page,
  }) => {
    // The WIF is derived from the same mnemonic (identity index 0, CRITICAL
    // auth key), so both sign-in paths must land on the same identity. The
    // "Sign out" button's title carries the signed-in short ID.
    await loginAs(page, 0);
    const mnemonicTitle = await page
      .getByRole("button", { name: "Sign out" })
      .getAttribute("title");
    expect(mnemonicTitle).toMatch(/^Signed in as /);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeEnabled({ timeout: 60_000 });

    const wif = await deriveWifFromMnemonic(0, 2);
    await loginWithWif(page, wif);
    const wifTitle = await page
      .getByRole("button", { name: "Sign out" })
      .getAttribute("title");

    expect(wifTitle).toBe(mnemonicTitle);
  });
});
