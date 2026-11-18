import type { Page } from "@playwright/test";
import {
  expect,
  expectNoHorizontalOverflow,
  gotoDiscover,
  LOAD_TIMEOUT,
  nav,
  REGISTRY_ID,
  test,
} from "./fixtures";

// Settings and the registry selection. Nothing here publishes a registry.

// A registry published for an older version of the app.
const OLDER_REGISTRY = "BXcWyLZDtcPrEmd8tmPt6A7h4YuqgPGVJU1PBvs1dYiS";

const override = (page: Page) =>
  page.evaluate(() => localStorage.getItem("dashapps.contractId.testnet"));

async function openEditor(page: Page) {
  await gotoDiscover(page);
  await nav(page, "Settings");
  await expectNoHorizontalOverflow(page);
  await expect(page.locator(".registry-value code")).toHaveText(REGISTRY_ID);
  await page.getByRole("button", { name: "Change" }).click();
  const input = page.getByLabel("Registry contract ID");
  await expect(input).toBeVisible();
  await expect(input).toHaveValue(REGISTRY_ID);
  return input;
}

test("an invalid registry ID shows an error and saves nothing", async ({
  page,
}) => {
  const input = await openEditor(page);
  await input.fill("not-a-registry");
  await page.getByRole("button", { name: "Save registry" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    /valid 32-byte Platform identifier|Invalid registry contract ID/,
  );
  await expect(input).toBeVisible();
  expect(await override(page)).toBeNull();

  await input.fill(REGISTRY_ID);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("saving the default registry stores no override", async ({ page }) => {
  const input = await openEditor(page);
  await input.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "saved" }),
  ).toHaveText("Registry selection saved.");
  await expect(input).toHaveCount(0);
  await expect(page.locator(".registry-value code")).toHaveText(REGISTRY_ID);
  expect(await override(page)).toBeNull();
});

test("another registry applies, and an older one offers the default back", async ({
  page,
}) => {
  const input = await openEditor(page);
  await input.fill(OLDER_REGISTRY);
  await page.getByRole("button", { name: "Save registry" }).click();
  await expect(page.getByText("Registry selection saved.")).toBeVisible();
  await expect(page.locator(".registry-value code")).toHaveText(OLDER_REGISTRY);
  expect(await override(page)).toBe(OLDER_REGISTRY);

  await nav(page, "Discover");
  const notice = page.getByRole("alert").filter({
    hasText: "This registry was made for an older version of the app.",
  });
  await expect(notice).toBeVisible({ timeout: LOAD_TIMEOUT });
  await expectNoHorizontalOverflow(page);

  await notice
    .getByRole("button", { name: "Use the default registry" })
    .click();
  await expect(notice).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Built on Dash Platform" }),
  ).toBeVisible();
  await expect(
    page.locator(".registry-panel article.registry-entry").first(),
  ).toBeVisible({ timeout: LOAD_TIMEOUT });
  expect(await override(page)).toBeNull();
  await nav(page, "Settings");
  await expect(page.locator(".registry-value code")).toHaveText(REGISTRY_ID);
});

test("a saved registry survives a reload", async ({ page }) => {
  const input = await openEditor(page);
  await input.fill(OLDER_REGISTRY);
  await input.press("Enter");
  await expect(page.getByText("Registry selection saved.")).toBeVisible();
  await page.reload();
  await nav(page, "Settings");
  await expect(page.locator(".registry-value code")).toHaveText(OLDER_REGISTRY);
});

test("Publish is disabled for a guest, and Sign in opens the form", async ({
  page,
}) => {
  await gotoDiscover(page);
  await nav(page, "Settings");
  await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled();
  const card = page.locator(".settings-shell .signed-out-card");
  await expect(card).toContainText("Browsing as guest");
  await card.getByRole("button", { name: "Sign in" }).click();
  const dialog = page.getByRole("dialog", { name: "Sign in to dashapps" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(card).toBeVisible();
});
