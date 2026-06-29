import { test, expect, navTo } from "./fixtures";

// Settings checks: the sign-in form renders and gates correctly. These do not
// sign in — they assert form rendering and the Advanced disclosure only.

test.describe("settings", () => {
  test("renders the login form with a gated Sign in button", async ({
    page,
  }) => {
    await navTo(page, "Settings");

    await expect(
      page.getByRole("heading", { name: /^settings$/i }),
    ).toBeVisible();

    const mnemonic = page.getByLabel(/identity mnemonic/i);
    await expect(mnemonic).toBeVisible();

    const signIn = page.getByRole("button", { name: /^sign in$/i });
    await expect(signIn).toBeDisabled();
    await mnemonic.fill("alpha bravo charlie");
    await expect(signIn).toBeEnabled();
  });

  test("advanced section reveals the identity index and contract form", async ({
    page,
  }) => {
    await navTo(page, "Settings");

    const advanced = page.getByRole("button", { name: /advanced settings/i });
    await expect(advanced).toHaveAttribute("aria-expanded", "false");
    await advanced.click();
    await expect(advanced).toHaveAttribute("aria-expanded", "true");

    // Signed out: the identity-index input and the contract sub-form appear.
    await expect(page.locator('input[type="number"]')).toBeVisible();
    await expect(page.getByText(/^Current:/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /use contract/i }),
    ).toBeVisible();
  });
});
