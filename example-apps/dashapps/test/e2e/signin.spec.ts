import type { Page } from "@playwright/test";
import {
  detailLoaded,
  expect,
  gotoDiscover,
  LOAD_TIMEOUT,
  loadedListings,
  nav,
  test,
} from "./fixtures";

// The sign-in dialog and keyboard access. No test here signs in.

async function openSignIn(page: Page) {
  await gotoDiscover(page);
  const trigger = page
    .locator(".header-account")
    .getByRole("button", { name: "Sign in" });
  await expect(trigger).toBeEnabled({ timeout: LOAD_TIMEOUT });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Sign in to dashapps" });
  await expect(dialog).toBeVisible();
  return {
    trigger,
    dialog,
    secret: dialog.getByLabel("Mnemonic or private key"),
  };
}

test("the sign-in dialog opens and closes by ×, Cancel and backdrop", async ({
  page,
}) => {
  const { trigger, dialog, secret } = await openSignIn(page);
  await expect(secret).toBeFocused();
  await expect(secret).toHaveAttribute("type", "password");
  await dialog.getByRole("button", { name: "Close sign in" }).click();
  await expect(dialog).toHaveCount(0);

  await trigger.click();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);

  await trigger.click();
  await page.mouse.click(5, 5);
  await expect(dialog).toHaveCount(0);
});

test("Escape closes the sign-in dialog", async ({ page }) => {
  test.fail(true, "The sign-in dialog has no Escape handler");
  const { dialog } = await openSignIn(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("closing the sign-in dialog returns focus to its trigger", async ({
  page,
}) => {
  test.fail(true, "Focus falls to the page body when the dialog closes");
  const { trigger, dialog } = await openSignIn(page);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("sign-in validates empty and invalid secrets without signing in", async ({
  page,
}) => {
  const { dialog, secret } = await openSignIn(page);
  const submit = dialog.getByRole("button", { name: "Sign in", exact: true });
  await expect(submit).toBeEnabled();
  await submit.click();
  expect(
    await secret.evaluate(
      (input: HTMLInputElement) => input.validity.valueMissing,
    ),
  ).toBe(true);
  await expect(dialog).toBeVisible();

  await secret.fill("not a real recovery phrase");
  await submit.click();
  await expect(dialog.getByRole("alert")).toHaveText(/Invalid mnemonic/, {
    timeout: LOAD_TIMEOUT,
  });
  await expect(page.locator(".header-account")).toContainText("Sign in");
  await secret.fill("not a real recovery phrase!");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
});

test("advanced settings toggle the identity index and validate it", async ({
  page,
}) => {
  const { dialog, secret } = await openSignIn(page);
  const toggle = dialog.getByRole("button", { name: "Show advanced settings" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  const index = dialog.getByLabel("Identity index");
  await expect(index).toHaveValue("0");
  await expect(
    dialog.getByRole("button", { name: "Hide advanced settings" }),
  ).toHaveAttribute("aria-expanded", "true");

  await secret.fill("not a real recovery phrase");
  await index.fill("-1");
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  expect(
    await index.evaluate(
      (input: HTMLInputElement) => input.validity.rangeUnderflow,
    ),
  ).toBe(true);
  await expect(dialog.getByRole("alert")).toHaveCount(0);

  await dialog.getByRole("button", { name: "Hide advanced settings" }).click();
  await expect(index).toHaveCount(0);
});

test("a WIF-shaped secret hides the identity index", async ({ page }) => {
  const { dialog, secret } = await openSignIn(page);
  // A well-formed testnet WIF for the number 1; no identity uses it.
  await secret.fill("cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA");
  await expect(
    dialog.getByRole("button", { name: /advanced settings/ }),
  ).toHaveCount(0);
  await secret.fill("");
  await expect(
    dialog.getByRole("button", { name: "Show advanced settings" }),
  ).toBeVisible();
});

test("Mine prompts a guest to sign in", async ({ page }) => {
  await gotoDiscover(page);
  await nav(page, "Mine");
  const card = page.locator(".signed-out-card.mine-signin");
  await expect(card).toContainText("Sign in to view your entries");
  await card.getByRole("button", { name: "Sign in" }).click();
  const dialog = page.getByRole("dialog", { name: "Sign in to dashapps" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close sign in" }).click();
  await expect(card).toBeVisible();
});

test("Tab reaches the header and navigation buttons in order", async ({
  page,
}) => {
  await gotoDiscover(page);
  const order = [
    page.getByRole("link", { name: "dashapps" }),
    page.locator(".header-account").getByRole("button", { name: "Sign in" }),
    ...["Discover", "Search", "Mine", "Settings"].map((name) =>
      page
        .getByRole("navigation", { name: "App navigation" })
        .getByRole("button", { name, exact: true }),
    ),
  ];
  await expect(order[1]).toBeEnabled({ timeout: LOAD_TIMEOUT });
  for (const target of order) {
    await page.keyboard.press("Tab");
    await expect(target).toBeFocused();
  }
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Settings");
  await page.keyboard.press("Tab");
  await expect(
    page.locator(".settings-shell").getByRole("button", { name: "Sign in" }),
  ).toBeFocused();
});

test("Tab reaches a listing and Enter opens it", async ({ page }) => {
  const entries = await loadedListings(page);
  const first = entries.first();
  await first.locator(".entry-title").focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(first.locator(".entry-title")).toBeFocused();
  const name = (await first.locator(".entry-title").textContent())!.trim();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await detailLoaded(page);
});
