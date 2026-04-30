import { test, expect } from "./fixtures";

test("sidebar Login button opens the LoginModal with mnemonic input", async ({
  page,
}) => {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /login/i })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByPlaceholder("mnemonic phrase")).toBeVisible();
});

test("Advanced settings toggle reveals the identity index input", async ({
  page,
}) => {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /login/i })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /advanced settings/i }).click();
  await expect(dialog.getByText(/identity index/i).first()).toBeVisible();
  await expect(dialog.locator('input[type="number"]')).toBeVisible();
});

test("Esc closes the LoginModal", async ({ page }) => {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /login/i })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("Backdrop click closes the LoginModal", async ({ page }) => {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /login/i })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // Click the modal backdrop (just outside the dialog content).
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();
});

test("Mint-tab overlay Login button opens the LoginModal", async ({ page }) => {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /mint/i })
    .click();
  // Overlay is shown; click the Login CTA inside it (main column, not sidebar).
  await page.getByRole("main").getByRole("button", { name: /login/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByPlaceholder("mnemonic phrase"),
  ).toBeVisible();
});
