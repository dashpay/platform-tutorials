import { EvoSDK } from "@dashevo/evo-sdk";
import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_CONTRACT_IDS } from "../../src/dash/contractStore";

// Live, read-only rating checks against testnet. They only assert invariants
// that hold for any data, each between two independent queries:
//  - "Most recent" is server-ordered newest first.
//  - The proven rating total equals the number of reviews listed once every
//    page is loaded.
//  - The per-star histogram (grouped `count`) sums to the review count from
//    `average`.
//  - Each "Most rated" leaderboard row's review count (batched `average`)
//    matches the count on the app's own page.
//  - Every app the 4★+ filter keeps (`having`) averages at least 4.
// Ratings are deletable, so each test skips when the registry has none.

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

async function ratingTotal(page: Page) {
  const ratings = page.getByRole("region", { name: "Ratings and reviews" });
  const total = ratings.locator(".rating-average small");
  await expect(total).toHaveText(/^(\d+ ratings?|No ratings yet)$/, {
    timeout: LOAD_TIMEOUT,
  });
  const text = await total.textContent();
  return text === "No ratings yet" ? 0 : count(text);
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

test("an app's star histogram adds up to its review count", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const contractId = await mostRatedContract();
  test.skip(!contractId, "No ratings on the testnet registry to check.");
  await openContract(page, contractId!);

  const total = await ratingTotal(page);
  expect(total).toBeGreaterThan(0);
  const bars = page
    .getByRole("group", { name: "Ratings by star" })
    .getByRole("button");
  await expect(bars).toHaveCount(5);
  const labels = await bars.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("aria-label") ?? ""),
  );
  const sum = labels.reduce(
    (sum, label) => sum + Number(/: (\d+)$/.exec(label)?.[1] ?? NaN),
    0,
  );
  expect(sum).toBe(total);
});

test("each Most rated row matches the app's own review count", async ({
  page,
}) => {
  test.setTimeout(240_000);
  test.skip(
    !(await mostRatedContract()),
    "No ratings on the testnet registry to check.",
  );
  const board = page.getByRole("region", { name: "Leaderboards" });
  const rows = board.locator("button.side-row");
  const showMostRated = async () => {
    await page.goto("/");
    await board.getByRole("button", { name: "Most rated" }).click();
    await expect(rows.first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  };
  await showMostRated();
  const rowCount = await rows.count();
  for (let index = 0; index < rowCount; index++) {
    if (index > 0) await showMostRated();
    const row = rows.nth(index);
    const expected = count(
      await row.locator(".side-row-value small").textContent(),
    );
    expect(expected).toBeGreaterThan(0);
    await row.click();
    expect(await ratingTotal(page)).toBe(expected);
  }
});

test("every app the 4★+ filter keeps averages at least 4", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  const listings = page.locator(".registry-panel");
  await expect(listings.locator("article.registry-entry").first()).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  const chip = listings.getByRole("button", { name: "4★+" });
  await expect(chip).toBeEnabled({ timeout: LOAD_TIMEOUT });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");

  const kept = listings.locator("article.registry-entry");
  const keptCount = await kept.count();
  test.skip(keptCount === 0, "No loaded app averages 4★ or more.");
  for (let index = 0; index < keptCount; index++) {
    const rating = kept.nth(index).locator(".entry-rating");
    await expect(rating).toHaveText(/★ \d\.\d/, { timeout: LOAD_TIMEOUT });
    const average = Number(
      /★ (\d\.\d)/.exec((await rating.textContent())!)![1],
    );
    expect(average).toBeGreaterThanOrEqual(4);
  }
});
