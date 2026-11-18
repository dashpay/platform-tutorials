import { fileURLToPath } from "node:url";
import type { Locator, Page } from "@playwright/test";
import {
  detailLoaded,
  expect,
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
const DPNS_CONTRACT = "GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec";

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

/** Fails if the form would submit; every check here runs on invalid input. */
async function expectInvalid(form: Locator) {
  expect(
    await form.evaluate((node: HTMLFormElement) => node.checkValidity()),
  ).toBe(false);
}

test("the header shows the identity and signs out", async ({ page }) => {
  const identityId = await signIn(page);
  expect(identityId).toMatch(/^[1-9A-HJ-NP-Za-km-z]{42,44}$/);
  await expect(page.getByText("Connected · Signed in")).toBeAttached();
  await page
    .locator(".header-account")
    .getByRole("button", { name: "Sign out" })
    .click();
  await expect(
    page.locator(".header-account").getByRole("button", { name: "Sign in" }),
  ).toBeVisible();
  await expect(page.getByText("Connected · Read-only")).toBeAttached();
});

test("Settings shows the identity chip, refreshes the balance and signs out", async ({
  page,
}) => {
  const identityId = await signIn(page);
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
});

test("a contract's owner gets the owner panel instead of a review form", async ({
  page,
}) => {
  const identityId = await signIn(page);
  await openContract(page, OWNED_CONTRACT, { reload: false });
  await detailLoaded(page);
  const owner = await page
    .locator(".contract-owner-fact code")
    .textContent({ timeout: LOAD_TIMEOUT });
  test.skip(owner !== identityId, "The signed-in identity doesn't own it.");

  const panel = page.getByRole("region", { name: "Official listing" });
  await expect(panel).toContainText("You own this contract");
  await expect(
    panel.getByRole("button", {
      name: /Withdraw endorsement|Make official|Mark as official/,
    }),
  ).not.toHaveCount(0);
  for (const button of await panel.getByRole("button").all())
    await expect(button).toBeEnabled();

  const ratings = page.getByRole("region", { name: "Ratings and reviews" });
  await expect(ratings.locator(".rating-cta")).toContainText(
    "You own this contract",
  );
  await expect(
    ratings.getByRole("button", { name: /Write a review|Edit review/ }),
  ).toHaveCount(0);
  await expect(ratings.getByRole("radiogroup")).toHaveCount(0);
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
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });
    await expect(
      page.getByRole("button", { name: "← Discover" }),
    ).toBeVisible();
  }
});

test("the listing dialog validates and cancels without submitting", async ({
  page,
}) => {
  await signIn(page);
  await openContract(page, DPNS_CONTRACT, { reload: false });
  await detailLoaded(page);
  const open = page
    .locator(".listing-management")
    .getByRole("button", { name: /Add your entry|Edit your submission/ });
  await expect(open).toBeVisible({ timeout: LOAD_TIMEOUT });
  const adding = (await open.textContent()) === "Add your entry";
  await open.click();
  const dialog = page.getByRole("dialog", {
    name: adding ? "Submit metadata" : "Edit your submission",
  });
  await expect(dialog).toBeVisible();
  const form = dialog.locator("form");
  const submit = dialog.getByRole("button", {
    name: adding ? "Submit metadata" : "Save changes",
  });

  await dialog.getByLabel("Name", { exact: true }).fill("");
  await dialog.getByLabel("Tagline").fill("A tagline that is never saved");
  await dialog.getByLabel("Category").selectOption("identity");
  await dialog.getByLabel("App URL (optional)").fill("not a url");
  await expectInvalid(form);
  await submit.click();
  await expect(dialog).toBeVisible();
  expect(
    await dialog
      .getByLabel("Name", { exact: true })
      .evaluate((input: HTMLInputElement) => input.validity.valueMissing),
  ).toBe(true);
  await dialog.getByLabel("Name", { exact: true }).fill("Never saved");
  await expectInvalid(form);
  expect(
    await dialog
      .getByLabel("App URL (optional)")
      .evaluate((input: HTMLInputElement) => input.validity.typeMismatch),
  ).toBe(true);
  await expect(dialog.getByRole("status")).toHaveCount(0);

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeVisible();

  await open.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

/** Opens a listed app this identity neither owns nor has reviewed. */
async function openUnreviewed(page: Page, identityId: string) {
  await nav(page, "Discover");
  const entries = page.locator(".registry-panel article.registry-entry");
  await expect(entries.first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  const names = await entries.locator(".entry-title").allTextContents();
  for (const name of names) {
    await nav(page, "Discover");
    await entries
      .locator(".entry-title", { hasText: name })
      .first()
      .click({ timeout: LOAD_TIMEOUT });
    await detailLoaded(page);
    const cta = page.locator(".rating-cta");
    await expect(cta).not.toContainText("Checking for your rating…", {
      timeout: LOAD_TIMEOUT,
    });
    const owner = await page.locator(".contract-owner-fact code").textContent();
    if (owner !== identityId && (await cta.getByText("Write a review").count()))
      return;
  }
  test.skip(true, "Every listed app is owned or reviewed by this identity.");
}

test("the review dialog needs a star and cancels without saving", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const identityId = await signIn(page);
  await openUnreviewed(page, identityId);
  const ratings = page.getByRole("region", { name: "Ratings and reviews" });
  await ratings.getByRole("button", { name: "Write a review" }).click();
  const dialog = page.getByRole("dialog", { name: "Write a review" });
  await expect(dialog).toBeVisible();
  const submit = dialog.getByRole("button", { name: "Submit rating" });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel("Title (optional)").fill("Never saved");
  await dialog.getByLabel("Review (optional)").fill("Typed, then cancelled.");
  await expect(submit).toBeDisabled();
  const four = dialog.getByRole("radio", { name: "4 stars" });
  await four.click();
  await expect(four).toHaveAttribute("aria-checked", "true");
  // Enabled now; pressing it would save a review.
  await expect(submit).toBeEnabled();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(ratings.locator(".rating-cta")).toContainText("Used this app?");

  // A star in the summary opens the dialog with that star chosen.
  await ratings
    .locator(".rating-cta")
    .getByRole("radio", { name: "2 stars" })
    .click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "2 stars" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(submit).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("an existing review opens for editing and cancels", async ({ page }) => {
  await signIn(page);
  await openContract(page, DPNS_CONTRACT, { reload: false });
  await detailLoaded(page);
  const ratings = page.getByRole("region", { name: "Ratings and reviews" });
  const cta = ratings.locator(".rating-cta");
  await expect(cta).not.toContainText("Checking for your rating…", {
    timeout: LOAD_TIMEOUT,
  });
  const edit = cta.getByRole("button", { name: "Edit review" });
  test.skip(!(await edit.count()), "This identity hasn't reviewed DPNS.");
  await expect(ratings.locator("li.rating-card.own")).toContainText(
    "Your rating",
  );
  await edit.click();
  const dialog = page.getByRole("dialog", { name: "Edit your review" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("radio", { checked: true })).toHaveCount(1);
  await expect(
    dialog.getByRole("button", { name: "Remove rating" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Save changes" }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);

  await ratings
    .locator("li.rating-card.own")
    .getByRole("button", { name: "Edit" })
    .click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(dialog).toHaveCount(0);
});

test("closing the review dialog returns focus to its trigger", async ({
  page,
}) => {
  test.fail(true, "Focus falls to the page body when the dialog closes");
  await signIn(page);
  await openContract(page, DPNS_CONTRACT, { reload: false });
  await detailLoaded(page);
  const trigger = page
    .locator(".rating-cta")
    .getByRole("button", { name: /Write a review|Edit review/ });
  await expect(trigger).toBeEnabled({ timeout: LOAD_TIMEOUT });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: /review/ });
  await dialog.getByLabel("Title (optional)").click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
