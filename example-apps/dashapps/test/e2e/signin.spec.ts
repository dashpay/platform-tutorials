import {
  detailLoaded,
  expect,
  expectSignInDialog,
  gotoDiscover,
  LOAD_TIMEOUT,
  loadedListings,
  nav,
  test,
} from "./fixtures";

// The sign-in dialog and its entry points. No test here signs in.

test("the sign-in dialog closes by ×, Cancel, backdrop and Escape", async ({
  page,
}) => {
  await gotoDiscover(page);
  const trigger = page
    .locator(".header-account")
    .getByRole("button", { name: "Sign in" });
  await expect(trigger).toBeEnabled({ timeout: LOAD_TIMEOUT });
  const dialog = page.getByRole("dialog", { name: "Sign in to dashapps" });
  for (const close of [
    () => dialog.getByRole("button", { name: "Close sign in" }).click(),
    () => dialog.getByRole("button", { name: "Cancel" }).click(),
    () => page.mouse.click(5, 5),
  ]) {
    await trigger.click();
    await expect(dialog).toBeVisible();
    await close();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
  await expectSignInDialog(page, trigger);
});

test("sign-in validates the secret and the identity index", async ({
  page,
}) => {
  await gotoDiscover(page);
  const trigger = page
    .locator(".header-account")
    .getByRole("button", { name: "Sign in" });
  await expect(trigger).toBeEnabled({ timeout: LOAD_TIMEOUT });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Sign in to dashapps" });
  const secret = dialog.getByLabel("Mnemonic or private key");
  const submit = dialog.getByRole("button", { name: "Sign in", exact: true });
  await expect(secret).toHaveAttribute("type", "password");
  await submit.click();
  expect(
    await secret.evaluate(
      (input: HTMLInputElement) => input.validity.valueMissing,
    ),
  ).toBe(true);

  await secret.fill("not a real recovery phrase");
  await submit.click();
  await expect(dialog.getByRole("alert")).toHaveText(/Invalid mnemonic/, {
    timeout: LOAD_TIMEOUT,
  });
  await expect(page.locator(".header-account")).toContainText("Sign in");
  await secret.fill("not a real recovery phrase!");
  await expect(dialog.getByRole("alert")).toHaveCount(0);

  await test.step("advanced settings", async () => {
    const toggle = dialog.getByRole("button", { name: /advanced settings/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const index = dialog.getByLabel("Identity index");
    await expect(index).toHaveValue("0");
    await index.fill("-1");
    await submit.click();
    expect(
      await index.evaluate(
        (input: HTMLInputElement) => input.validity.rangeUnderflow,
      ),
    ).toBe(true);
    await toggle.click();
    await expect(index).toHaveCount(0);
  });
});

test("Mine and an app's rating prompt open sign-in", async ({ page }) => {
  const entries = await loadedListings(page);
  await nav(page, "Mine");
  const card = page.locator(".signed-out-card.mine-signin");
  await expect(card).toContainText("Sign in to view your entries");
  await card.getByRole("button", { name: "Sign in" }).click();
  const dialog = page.getByRole("dialog", { name: "Sign in to dashapps" });
  await dialog.getByRole("button", { name: "Close sign in" }).click();
  // The form replaced the card; focus goes back to the card's button.
  await expect(card.getByRole("button", { name: "Sign in" })).toBeFocused();

  await nav(page, "Discover");
  await entries.first().locator(".entry-title").click();
  await detailLoaded(page);
  await expectSignInDialog(
    page,
    page.getByRole("button", { name: "Sign in to rate" }),
  );
});
