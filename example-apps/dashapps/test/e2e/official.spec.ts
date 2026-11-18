import { EvoSDK } from "@dashevo/evo-sdk";
import { expect, test } from "@playwright/test";
import { DEFAULT_CONTRACT_IDS } from "../../src/dash/contractStore";

// Live, read-only: an app from the "Official only" feed (newest endorsements)
// carries the Official badge, and its own page shows the official listing.
// Endorsements are deletable, so the test skips when the registry has none.

const LOAD_TIMEOUT = 60_000;

async function hasEndorsement() {
  const sdk = EvoSDK.testnetTrusted();
  await sdk.connect();
  const documents = await sdk.documents.query({
    dataContractId: DEFAULT_CONTRACT_IDS.testnet,
    documentTypeName: "appEndorsement",
    limit: 1,
  });
  return documents.size > 0;
}

test("an endorsed app shows the Official badge", async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(!(await hasEndorsement()), "No endorsements on the registry.");
  await page.goto("/");
  const listings = page.locator(".registry-panel");
  const filter = listings.getByRole("group", { name: "Listing filter" });
  await filter.getByRole("button", { name: "Official only" }).click();
  const entries = listings.locator("article.registry-entry");
  await expect(entries.first()).toBeVisible({ timeout: LOAD_TIMEOUT });

  // The feed lists endorsements; the badge comes from a separate lookup of
  // each listed contract's endorsement.
  const first = entries.first();
  const name = (await first.locator(".entry-title").textContent())!;
  await expect(first.locator(".entry-badge.official")).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });

  await first.locator(".entry-title").click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await expect(
    page.getByText("Official listing, chosen by the contract owner"),
  ).toBeVisible({ timeout: LOAD_TIMEOUT });
});
