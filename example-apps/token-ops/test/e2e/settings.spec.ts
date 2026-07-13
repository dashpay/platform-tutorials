import { test, expect } from "./fixtures";

/**
 * Settings view — read-only coverage.
 *
 * Drives the real contract-ID resolver against testnet (a read), but performs
 * no chain write. Registering a contract is a signed-in write flow and is
 * deferred to the future write-flow pass.
 */
test.describe("Settings (read-only)", () => {
  test("shows the read-only card when signed out", async ({ page }) => {
    await page.getByRole("button", { name: "Settings", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "Read-only mode" }),
    ).toBeVisible();
    await expect(
      page.getByText(/Sign in from the top bar to register contracts/),
    ).toBeVisible();
  });

  test("register-contract is disabled when signed out", async ({ page }) => {
    await page.getByRole("button", { name: "Settings", exact: true }).click();

    await expect(
      page.getByRole("button", { name: "Register new TokenOps contract…" }),
    ).toBeDisabled();
    await expect(
      page.getByText("Sign in before registering a new contract."),
    ).toBeVisible();
  });

  test("contract resolver rejects a malformed ID", async ({ page }) => {
    // The resolver calls the SDK, which is a no-op until the app finishes
    // auto-connecting to testnet. The top-bar "Sign in" button is disabled
    // ("Connecting...") until then, so wait for it to become enabled.
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeEnabled({ timeout: 60_000 });
    await page.getByRole("button", { name: "Settings", exact: true }).click();

    await page.getByPlaceholder("Contract or token ID").fill("not-a-real-id");
    await page.getByRole("button", { name: "Use", exact: true }).click();

    await expect(page.locator(".notice.error")).toBeVisible({
      timeout: 60_000,
    });
  });

  test("contract resolver accepts the default contract ID", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeEnabled({ timeout: 60_000 });
    await page.getByRole("button", { name: "Settings", exact: true }).click();

    await page
      .getByPlaceholder("Contract or token ID")
      .fill("KMMJJdJo9LTjjevsuJ4jkbNZEY8xCq8n44cDmba7o2A");
    await page.getByRole("button", { name: "Use", exact: true }).click();

    // A successful resolve renders the "Using contract" / "Resolved token"
    // info notice; no error notice appears.
    await expect(page.getByText(/Using contract|Resolved token/)).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator(".notice.error")).toHaveCount(0);
  });

  test("clear override refills the input with the default contract", async ({
    page,
  }) => {
    const DEFAULT = "KMMJJdJo9LTjjevsuJ4jkbNZEY8xCq8n44cDmba7o2A";
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeEnabled({ timeout: 60_000 });
    await page.getByRole("button", { name: "Settings", exact: true }).click();

    // Set an override, then clear it. Clearing re-derives the session back to
    // the default contract; the input must refill with that resolved value in
    // place — regression test: it previously blanked and only refilled on a
    // remount (nav away and back).
    const input = page.getByPlaceholder("Contract or token ID");
    await input.fill(DEFAULT);
    await page.getByRole("button", { name: "Use", exact: true }).click();
    await expect(page.getByText(/Using contract|Resolved token/)).toBeVisible({
      timeout: 60_000,
    });

    await page
      .getByRole("button", { name: "Clear override", exact: true })
      .click();
    await expect(input).toHaveValue(DEFAULT);
  });
});
