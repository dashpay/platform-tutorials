import { EvoSDK } from "@dashevo/evo-sdk";
import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_CONTRACT_IDS } from "../../src/dash/contractStore";

// Live, read-only rating checks against testnet. They only assert invariants
// that hold for any data:
//  - "Most recent" is server-ordered newest first.
//  - The proven rating total equals the number of reviews listed once every
//    page is loaded.
// Ratings are deletable, so the test skips when the registry has none.

const LOAD_TIMEOUT = 60_000;
const REGISTRY_ID = DEFAULT_CONTRACT_IDS.testnet;

async function mostRatedContract(): Promise<string | undefined> {
  const sdk = EvoSDK.testnetTrusted();
  await sdk.connect();
  const { entries } = await sdk.documents.ranked({
    dataContractId: REGISTRY_ID,
    documentTypeName: "appReview",
    groupBy: "contractId",
    aggregate: { type: "count" },
    limit: 1,
  });
  const contractId = entries[0]?.groupValue;
  return typeof contractId === "string" ? contractId : undefined;
}

async function openContract(page: Page, contractId: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByLabel("Open a contract").fill(contractId);
  const open = page.getByRole("button", { name: "Open", exact: true });
  await expect(open).toBeEnabled({ timeout: LOAD_TIMEOUT });
  await open.click();
}

function count(text: string | null) {
  const match = /(\d+)/.exec(text ?? "");
  return match ? Number(match[1]) : NaN;
}

test("an app's reviews are newest first and match its rating total", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const contractId = await mostRatedContract();
  test.skip(!contractId, "No ratings on the testnet registry to check.");
  await openContract(page, contractId!);

  const ratings = page.getByRole("region", { name: "Ratings and reviews" });
  const total = ratings.locator(".rating-average small");
  await expect(total).toHaveText(/^\d+ ratings?$/, { timeout: LOAD_TIMEOUT });
  const expected = count(await total.textContent());
  expect(expected).toBeGreaterThan(0);

  await expect(
    ratings.getByRole("group", { name: "Ratings by star" }).getByRole("button"),
  ).toHaveCount(5);

  // Load every page so the list can be compared with the total.
  const cards = ratings.locator("li.rating-card");
  await expect(cards.first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  const more = ratings.getByRole("button", { name: "Load more" });
  while (await more.isVisible()) {
    const before = await cards.count();
    await more.click();
    await expect
      .poll(() => cards.count(), { timeout: LOAD_TIMEOUT })
      .toBeGreaterThan(before);
  }
  const updated = (await cards.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-updated-at") ?? ""),
  )) as string[];
  expect(updated).toHaveLength(expected);
  for (let index = 1; index < updated.length; index++)
    expect(BigInt(updated[index])).toBeLessThanOrEqual(
      BigInt(updated[index - 1]),
    );
});
