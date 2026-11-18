import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import {
  detailLoaded,
  DPNS_CONTRACT,
  expect,
  expectApp,
  gotoDiscover,
  LOAD_TIMEOUT,
  nav,
  openContract,
  test,
} from "./fixtures";

// Signed in through the app's own form, read-only: dialogs are opened,
// filled and cancelled, and no write button is ever pressed. Needs
// PLATFORM_MNEMONIC, from the environment or the repository's .env.

try {
  process.loadEnvFile(
    fileURLToPath(new URL("../../../../.env", import.meta.url)),
  );
} catch {
  // No .env; the environment may still provide the mnemonic.
}
const MNEMONIC = process.env.PLATFORM_MNEMONIC;
// The DashRate example's contract, owned by the tutorials' identity.
const OWNED_CONTRACT = "EJHQrRenbFXEPvhgFXD7v8F2ewkqZ2JEdHGKMshZauxz";

test.skip(!MNEMONIC, "PLATFORM_MNEMONIC is not set.");
// Traces would record the recovery phrase typed into the form.
test.use({ trace: "off" });
test.describe.configure({ timeout: 90_000 });

async function signIn(page: Page) {
  await gotoDiscover(page);
  await page
    .locator(".header-account")
    .getByRole("button", { name: "Sign in" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Sign in to dashapps" });
  // Set through the DOM so the phrase never appears in a step title.
  await dialog
    .getByLabel("Mnemonic or private key")
    .evaluate((input: HTMLInputElement, secret) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(input, secret);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, MNEMONIC!);
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog).toHaveCount(0, { timeout: LOAD_TIMEOUT });
  const account = page.locator(".header-account");
  await expect(account.getByRole("button", { name: "Sign out" })).toBeVisible();
  return (await account.locator("span").getAttribute("title"))!;
}

test("the owner panel, identity chip and sign-out", async ({ page }) => {
  const identityId = await signIn(page);
  expect(identityId).toMatch(/^[1-9A-HJ-NP-Za-km-z]{42,44}$/);
  await expect(page.getByText("Connected · Signed in")).toBeAttached();

  await openContract(page, OWNED_CONTRACT, { reload: false });
  await detailLoaded(page);
  const owner = page.locator(".contract-owner-fact code");
  if ((await owner.textContent()) === identityId) {
    const panel = page.getByRole("region", { name: "Official listing" });
    await expect(panel).toContainText("You own this contract");
    for (const button of await panel.getByRole("button").all())
      await expect(button).toBeEnabled();
    const ratings = page.getByRole("region", { name: "Ratings and reviews" });
    await expect(ratings.locator(".rating-cta")).toContainText(
      "You own this contract",
    );
    await expect(ratings.getByRole("radiogroup")).toHaveCount(0);
  }

  await nav(page, "Settings");
  const chip = page.getByRole("region", { name: "Signed-in identity" });
  await expect(chip.locator("code")).toHaveText(identityId);
  await expect(chip).toContainText(/Balance: [\d,]+ credits/, {
    timeout: LOAD_TIMEOUT,
  });
  const refresh = chip.getByRole("button", { name: "Refresh balance" });
  await refresh.click();
  await expect(refresh).toBeEnabled({ timeout: LOAD_TIMEOUT });
  await expect(chip.getByRole("alert")).toHaveCount(0);
  // Enabled once signed in; pressing it would publish a registry.
  await expect(page.getByRole("button", { name: "Publish" })).toBeEnabled();

  await chip.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByText("Browsing as guest")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled();
  await expect(
    page.locator(".header-account").getByRole("button", { name: "Sign in" }),
  ).toBeVisible();
  await expect(page.getByText("Connected · Read-only")).toBeAttached();
});

test("Mine lists your entries and what you endorsed", async ({ page }) => {
  await signIn(page);
  await nav(page, "Mine");
  const panel = page.locator(".registry-panel");
  await expect(
    panel.getByRole("heading", { name: "Your entries" }),
  ).toBeVisible();
  const entries = panel.locator("article.registry-entry");
  const endorsed = page
    .locator(".side-panel")
    .filter({ has: page.getByRole("heading", { name: "Endorsed by you" }) });
  await expect(endorsed).toBeVisible();
  await expect(endorsed.getByRole("status")).toHaveCount(0, {
    timeout: LOAD_TIMEOUT,
  });
  await expect(
    entries.first().or(panel.getByText("No registry entries found.")),
  ).toBeVisible({ timeout: LOAD_TIMEOUT });
  test.skip((await entries.count()) === 0, "This identity has no entries.");
  for (const entry of await entries.all())
    await expect(entry.locator(".entry-badge.own")).toHaveText("Your entry");

  const edit = entries.first().getByRole("button", { name: "Edit" });
  await expect(edit).toBeVisible({ timeout: LOAD_TIMEOUT });
  await edit.click();
  const dialog = page.getByRole("dialog", { name: "Edit your submission" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Name", { exact: true })).not.toHaveValue("");
  await expect(dialog.getByRole("button", { name: "Withdraw" })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);

  const rows = endorsed.locator("button.side-row");
  if (await rows.count()) {
    const name = (await rows
      .first()
      .locator(".side-row-title")
      .evaluate((node) => node.firstChild?.textContent ?? ""))!.trim();
    await rows.first().click();
    await expectApp(page, name);
    await page.getByRole("button", { name: "← Mine" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mine");
  }
});

test("the listing and review dialogs validate and cancel without saving", async ({
  page,
}) => {
  await signIn(page);
  await openContract(page, DPNS_CONTRACT, { reload: false });
  await detailLoaded(page);

  await test.step("the listing dialog", async () => {
    const open = page
      .locator(".listing-management")
      .getByRole("button", { name: /Add your entry|Edit your submission/ });
    await expect(open).toBeVisible({ timeout: LOAD_TIMEOUT });
    const adding = (await open.textContent()) === "Add your entry";
    await open.click();
    const dialog = page.getByRole("dialog", {
      name: adding ? "Submit metadata" : "Edit your submission",
    });
    const name = dialog.getByLabel("Name", { exact: true });
    const url = dialog.getByLabel("App URL (optional)");
    // The write button is never pressed; the form's own validity is checked.
    const form = dialog.locator("form");
    await name.fill("");
    await url.fill("not a url");
    expect(
      await name.evaluate(
        (input: HTMLInputElement) => input.validity.valueMissing,
      ),
    ).toBe(true);
    await name.fill("Never saved");
    expect(
      await url.evaluate(
        (input: HTMLInputElement) => input.validity.typeMismatch,
      ),
    ).toBe(true);
    expect(
      await form.evaluate((element: HTMLFormElement) =>
        element.checkValidity(),
      ),
    ).toBe(false);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await open.click();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();
  });

  const ratings = page.getByRole("region", { name: "Ratings and reviews" });
  const cta = ratings.locator(".rating-cta");
  const trigger = cta.getByRole("button", {
    name: /Write a review|Edit review/,
  });
  await expect(trigger).toBeEnabled({ timeout: LOAD_TIMEOUT });
  const editing = (await trigger.textContent()) === "Edit review";
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: editing ? "Edit your review" : "Write a review",
  });
  const submit = dialog.getByRole("button", {
    name: editing ? "Save changes" : "Submit rating",
  });
  if (editing) {
    await expect(dialog.getByRole("radio", { checked: true })).toHaveCount(1);
    await expect(
      dialog.getByRole("button", { name: "Remove rating" }),
    ).toBeVisible();
  } else {
    await expect(submit).toBeDisabled();
    await dialog.getByRole("radio", { name: "4 stars" }).click();
  }
  // Enabled; pressing it would save a review.
  await expect(submit).toBeEnabled();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  if (!editing) {
    // A star in the summary opens the dialog with that star chosen.
    await cta.getByRole("radio", { name: "2 stars" }).click();
    await expect(
      dialog.getByRole("radio", { name: "2 stars" }),
    ).toHaveAttribute("aria-checked", "true");
    await dialog.getByRole("button", { name: "Cancel" }).click();
  }

  await trigger.click();
  await dialog.getByLabel("Title (optional)").click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await page
    .locator(".header-account")
    .getByRole("button", { name: "Sign out" })
    .click();
  await expect(trigger).toHaveCount(0);
});
