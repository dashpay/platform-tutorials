import { EvoSDK } from "@dashevo/evo-sdk";
import {
  expect,
  test as base,
  type ConsoleMessage,
  type Locator,
  type Page,
} from "@playwright/test";
import { DEFAULT_CONTRACT_IDS } from "../../src/dash/contractStore";

// Shared helpers for the specs. Every test fails on a console error or an
// uncaught page error.

export const LOAD_TIMEOUT = 60_000;
export const REGISTRY_ID = DEFAULT_CONTRACT_IDS.testnet;
export const DPNS_CONTRACT = "GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec";

// A testnet node refusing or dropping a connection: the SDK moves on to
// another node, and a read that still fails shows up in the UI instead.
function benign(message: ConsoleMessage) {
  const { url } = message.location();
  return (
    /^Failed to load resource: net::ERR_/.test(message.text()) &&
    URL.canParse(url) &&
    new URL(url).hostname !== "localhost"
  );
}

export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, provide) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error" && !benign(message))
          errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await provide(errors);
      expect(errors, "console and page errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Waits for the app's own connection status, read-only or signed in. */
export async function connected(page: Page) {
  await expect(page.getByText(/^Connected · /)).toBeAttached({
    timeout: LOAD_TIMEOUT,
  });
}

export async function gotoDiscover(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Built on Dash Platform" }),
  ).toBeVisible();
  await connected(page);
}

/** Discover's feed rows once the first page has loaded; skips when empty. */
export async function loadedListings(page: Page) {
  await gotoDiscover(page);
  const entries = page.locator(".registry-panel article.registry-entry");
  const found = await entries
    .first()
    .waitFor({ timeout: LOAD_TIMEOUT })
    .then(
      () => true,
      () => false,
    );
  test.skip(!found, "No listings on the registry.");
  await expect(page.locator(".registry-panel > p[role=status]")).toHaveCount(
    0,
    { timeout: LOAD_TIMEOUT },
  );
  return entries;
}

/** A listing's name, without the badges and rating beside it. */
export async function entryName(entry: Locator) {
  return (await entry.locator(".entry-title").textContent())!.trim();
}

/** Waits for the app page titled `name`. */
export async function expectApp(page: Page, name: string) {
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
}

export async function nav(page: Page, name: string) {
  const button = page
    .getByRole("navigation", { name: "App navigation" })
    .getByRole("button", { name, exact: true });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

/** Opens a contract from Search; `reload: false` keeps the session. */
export async function openContract(
  page: Page,
  contractId: string,
  { reload = true } = {},
) {
  if (reload) await gotoDiscover(page);
  await nav(page, "Search");
  await page.getByLabel("Open a contract").fill(contractId);
  const open = page.getByRole("button", { name: "Open", exact: true });
  await expect(open).toBeEnabled({ timeout: LOAD_TIMEOUT });
  await open.click();
  await expect(page.locator(".detail-page")).toBeVisible();
}

/** The detail page once its contract, listings and ratings have loaded. */
export async function detailLoaded(page: Page) {
  await expect(page.locator(".technical-details")).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
    timeout: LOAD_TIMEOUT,
  });
  await expect(
    page
      .getByRole("region", { name: "Ratings and reviews" })
      .locator(".rating-average small"),
  ).toHaveText(/^(\d+ ratings?|No ratings yet)$/, { timeout: LOAD_TIMEOUT });
}

export async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
}

/** The sign-in dialog, closed by Escape with focus back on `trigger`. */
export async function expectSignInDialog(page: Page, trigger: Locator) {
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Sign in to dashapps" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Mnemonic or private key")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
}

let sdk: Promise<EvoSDK> | undefined;
function testnet() {
  sdk ??= (async () => {
    const client = EvoSDK.testnetTrusted();
    await client.connect();
    return client;
  })();
  return sdk;
}

type Json = Record<string, unknown>;

async function documents(
  documentTypeName: string,
  limit = 100,
  orderBy?: [string, "asc" | "desc"][],
) {
  const client = await testnet();
  const result = await client.documents.query({
    dataContractId: REGISTRY_ID,
    documentTypeName,
    limit,
    ...(orderBy ? { where: [], orderBy } : {}),
  });
  return [...result.values()].map(
    (document) => (document?.toJSON(client.version()) ?? {}) as Json,
  );
}

/** The name Search shows for the newest listed app: its official or only listing. */
export async function listedName() {
  const entries = await documents("appMetadata", 100, [["$createdAt", "desc"]]);
  const official = new Map(
    (await documents("appEndorsement")).map((e) => [
      e.contractId,
      e.publisherId,
    ]),
  );
  const perContract = new Map<unknown, number>();
  for (const { contractId } of entries)
    perContract.set(contractId, (perContract.get(contractId) ?? 0) + 1);
  const shown = entries.find(
    (entry) =>
      perContract.get(entry.contractId) === 1 ||
      official.get(entry.contractId) === entry.$ownerId,
  );
  return typeof shown?.name === "string" ? shown.name : undefined;
}

/** Review counts per contract, from up to 100 reviews, most reviewed first. */
export async function reviewCounts() {
  const counts = new Map<string, { total: number; written: number }>();
  for (const { contractId, body } of await documents("appReview")) {
    if (typeof contractId !== "string") continue;
    const count = counts.get(contractId) ?? { total: 0, written: 0 };
    count.total++;
    if (typeof body === "string" && body) count.written++;
    counts.set(contractId, count);
  }
  return [...counts].sort(([, left], [, right]) => right.total - left.total);
}
