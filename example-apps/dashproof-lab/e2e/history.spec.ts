// Authed tests assume the configured PLATFORM_MNEMONIC has at least one
// existing anchor on testnet. anchor.spec.ts creates one when run; if you
// run history.spec.ts in isolation against a brand-new identity, the
// "My anchors" tests will fail.

import {
  test,
  expect,
  gotoHistory,
  gotoVerify,
  loginViaModal,
  clickNav,
  HAS_MNEMONIC,
} from "./fixtures";

const KNOWN_CHAIN_ID = "demo-proof-fixture-01";
const EXPLORER_DOC_HREF =
  'a[href^="https://testnet.platform-explorer.com/document/"]';

test.describe("History panel — chain lookup (read-only)", () => {
  test("loads anchors for a known chain ID", async ({ page }) => {
    await gotoHistory(page);

    const chainInput = page.getByPlaceholder("invoice-2026-04");
    await expect(chainInput).toBeVisible();

    await chainInput.fill(KNOWN_CHAIN_ID);
    await page.getByRole("button", { name: "Load chain" }).click();

    await expect(page.locator(`text=${KNOWN_CHAIN_ID}`).first()).toBeVisible();
    await expect(page.locator(EXPLORER_DOC_HREF).first()).toBeVisible();
  });

  test('"My anchors" tab is disabled when not authenticated', async ({ page }) => {
    await gotoHistory(page);
    await expect(page.getByRole("tab", { name: /My anchors/ })).toBeDisabled();
  });

  test("shows no-anchors notice for an unused chain ID", async ({ page }) => {
    await gotoHistory(page);

    const fakeChain = `e2e-nonexistent-${Date.now()}`;
    await page.getByPlaceholder("invoice-2026-04").fill(fakeChain);
    await page.getByRole("button", { name: "Load chain" }).click();

    await expect(
      page.getByText("No anchors found for that chain."),
    ).toBeVisible();
  });

  test("renders timeline rows in newest-first order", async ({ page }) => {
    await gotoHistory(page);

    await page.getByPlaceholder("invoice-2026-04").fill(KNOWN_CHAIN_ID);
    await page.getByRole("button", { name: "Load chain" }).click();

    // Wait for the chain header to render before scraping rows.
    await expect(page.locator(EXPLORER_DOC_HREF).first()).toBeVisible();

    // Each TimelineRow surfaces a compact timestamp via formatCompactTimestamp.
    // Pull every visible "Mon DD, YYYY, h:mm AM/PM" string and confirm
    // descending order. With one row it's trivially true.
    const dates = await page.evaluate(() => {
      const matches = Array.from(
        document.querySelectorAll("article, [class*='timeline'], time, span"),
      )
        .map((el) => el.textContent ?? "")
        .filter((t) => /\b\d{4}\b/.test(t) && /:\d{2}/.test(t))
        .map((t) => Date.parse(t.trim()))
        .filter((n) => !Number.isNaN(n));
      return matches;
    });

    for (let i = 1; i < dates.length; i += 1) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }
  });

  test("chain-header copy button copies the chainId and shows the panel toast", async ({
    page,
  }) => {
    await gotoHistory(page);

    await page.getByPlaceholder("invoice-2026-04").fill(KNOWN_CHAIN_ID);
    await page.getByRole("button", { name: "Load chain" }).click();
    await expect(page.locator(EXPLORER_DOC_HREF).first()).toBeVisible();

    // The chain header has its own CopyButton next to the chainId, separate
    // from per-row IdField copies. Scope to the header bar by its "Chain"
    // section label and click the only copy-chain button there.
    const copyChainBtn = page
      .getByRole("button", { name: "Copy chain" })
      .first();
    await copyChainBtn.click();

    await expect(page.getByText("Chain copied")).toBeVisible();

    const clipboardValue = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboardValue).toBe(KNOWN_CHAIN_ID);
  });
});

test.describe("History panel — Verify deep link", () => {
  test("clicking 'View chain history' from Verify pre-fills and loads the chain", async ({
    page,
    fixtureFile,
  }) => {
    await gotoVerify(page);

    const fixture = fixtureFile("proof-fixture-01.txt");
    await page.getByLabel("Select file", { exact: true }).setInputFiles({
      name: fixture.name,
      mimeType: fixture.mimeType,
      buffer: fixture.buffer,
    });

    await expect(page.getByText("Proof found")).toBeVisible();

    await page.getByRole("button", { name: "View chain history" }).click();

    // The History tab is now active; the chain search input should be
    // pre-filled and a chain timeline should render.
    await expect(page.getByPlaceholder("invoice-2026-04")).toHaveValue(
      KNOWN_CHAIN_ID,
    );
    await expect(page.locator(EXPLORER_DOC_HREF).first()).toBeVisible();
  });
});

test.describe("History panel — authed (requires PLATFORM_MNEMONIC)", () => {
  test.skip(!HAS_MNEMONIC, "PLATFORM_MNEMONIC not set");

  test('"My anchors" tab is enabled, selected, and shows summary stats', async ({
    page,
  }) => {
    await page.goto("/");
    await loginViaModal(page);
    await clickNav(page, "History");
    // Wait for owner query to resolve before assertions.
    // (listAnchorsByOwner is fired in an effect after the panel mounts.)


    const myTab = page.getByRole("tab", { name: /My anchors/ });
    await expect(myTab).toBeEnabled();
    await expect(myTab).toHaveAttribute("aria-selected", "true");

    await expect(
      page.getByText(/\d+ proofs? across \d+ chains?/),
    ).toBeVisible();
  });

  test("My anchors mode renders at least one Platform Explorer link", async ({
    page,
  }) => {
    await page.goto("/");
    await loginViaModal(page);
    await clickNav(page, "History");
    // Wait for owner query to resolve before assertions.
    // (listAnchorsByOwner is fired in an effect after the panel mounts.)


    await expect(page.locator(EXPLORER_DOC_HREF).first()).toBeVisible();
  });

  test('switching to "By chain" reveals the search form', async ({ page }) => {
    await page.goto("/");
    await loginViaModal(page);
    await clickNav(page, "History");
    // Wait for owner query to resolve before assertions.
    // (listAnchorsByOwner is fired in an effect after the panel mounts.)


    // "By chain" tab is the second tab in the segmented control.
    await page.getByRole("tab", { name: "By chain" }).click();
    await expect(page.getByPlaceholder("invoice-2026-04")).toBeVisible();
  });
});
