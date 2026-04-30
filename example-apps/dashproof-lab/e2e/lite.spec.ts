import { test, expect } from "./fixtures";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Vite serves files under public/ at the URL root, so the lite page lives at
// /dashproof-lite.html during dev and at /<base>/dashproof-lite.html after a
// production build. These specs use the dev server (configured in
// playwright.config.ts) so the path is just /dashproof-lite.html.
const LITE_URL = "/dashproof-lite.html";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixtureFile(filename: string) {
  const path = resolve(__dirname, "../public/example-files", filename);
  return {
    name: filename,
    mimeType: filename.endsWith(".json")
      ? "application/json"
      : filename.endsWith(".csv")
        ? "text/csv"
        : "text/plain",
    buffer: readFileSync(path),
  };
}

test.describe("dashproof-lite (single-file companion)", () => {
  test("connects to testnet and enables inputs on load", async ({ page }) => {
    await page.goto(LITE_URL);
    await expect(page.locator("#status")).toHaveText(/Connected to testnet/, {
      timeout: 30_000,
    });
    await expect(page.locator("#verify-file")).toBeEnabled();
    await expect(page.locator("#chain-id")).toBeEnabled();
    await expect(page.locator("#chain-btn")).toBeEnabled();
  });

  test("verify match: shows anchor card for a known fixture", async ({
    page,
  }) => {
    await page.goto(LITE_URL);
    await expect(page.locator("#status")).toHaveText(/Connected to testnet/, {
      timeout: 30_000,
    });

    const fixture = loadFixtureFile("proof-fixture-01.txt");
    await page.locator("#verify-file").setInputFiles({
      name: fixture.name,
      mimeType: fixture.mimeType,
      buffer: fixture.buffer,
    });

    // Hash echo above the result confirms SHA-256 ran client-side.
    await expect(page.locator("#verify-hash")).toContainText(
      "02e4e7cd6b6c73ec895e82d5e59065f30ffbb70f03fdd7d2a575ffd0c333d414",
      { timeout: 30_000 },
    );

    // Anchor card lists the chainId and the decoded SHA-256 hex.
    const card = page.locator("#verify-result .anchor");
    await expect(card).toBeVisible({ timeout: 60_000 });
    await expect(card).toContainText("demo-proof-fixture-01");
    await expect(card).toContainText(
      "02e4e7cd6b6c73ec895e82d5e59065f30ffbb70f03fdd7d2a575ffd0c333d414",
    );
  });

  test("verify miss: shows not-found banner for a random file", async ({
    page,
    randomFilePayload,
  }) => {
    await page.goto(LITE_URL);
    await expect(page.locator("#status")).toHaveText(/Connected to testnet/, {
      timeout: 30_000,
    });

    await page.locator("#verify-file").setInputFiles({
      name: randomFilePayload.name,
      mimeType: randomFilePayload.mimeType,
      buffer: randomFilePayload.buffer,
    });

    await expect(
      page.locator("#verify-result .status-line.miss"),
    ).toContainText("No anchor found", { timeout: 60_000 });
  });

  test("history: lists anchors for a known chainId", async ({ page }) => {
    await page.goto(LITE_URL);
    await expect(page.locator("#status")).toHaveText(/Connected to testnet/, {
      timeout: 30_000,
    });

    // Switch to History tab.
    await page.locator('.nav-btn[data-tab="history"]').click();
    await expect(page.locator("#panel-history")).toHaveClass(/active/);

    await page.locator("#chain-id").fill("demo-proof-fixture-01");
    await page.locator("#chain-btn").click();

    await expect(page.locator("#chain-result .summary-line")).toContainText(
      /\d+ anchor\(s\) found/,
      { timeout: 60_000 },
    );
    const cards = page.locator("#chain-result .anchor");
    await expect(cards.first()).toBeVisible();
    await expect(cards.first()).toContainText("demo-proof-fixture-01");
  });

  test("history miss: shows not-found banner for an unknown chainId", async ({
    page,
  }) => {
    await page.goto(LITE_URL);
    await expect(page.locator("#status")).toHaveText(/Connected to testnet/, {
      timeout: 30_000,
    });

    await page.locator('.nav-btn[data-tab="history"]').click();
    await page
      .locator("#chain-id")
      .fill(
        `bogus-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      );
    await page.locator("#chain-btn").click();

    await expect(page.locator("#chain-result .status-line.miss")).toContainText(
      "No anchors found",
      { timeout: 60_000 },
    );
  });

  test("tab switching toggles panel visibility without reload", async ({
    page,
  }) => {
    await page.goto(LITE_URL);
    await expect(page.locator("#status")).toHaveText(/Connected to testnet/, {
      timeout: 30_000,
    });

    // Verify is active on load.
    await expect(page.locator("#panel-verify")).toHaveClass(/active/);
    await expect(page.locator("#panel-history")).not.toHaveClass(/active/);

    await page.locator('.nav-btn[data-tab="history"]').click();
    await expect(page.locator("#panel-history")).toHaveClass(/active/);
    await expect(page.locator("#panel-verify")).not.toHaveClass(/active/);

    await page.locator('.nav-btn[data-tab="verify"]').click();
    await expect(page.locator("#panel-verify")).toHaveClass(/active/);
    await expect(page.locator("#panel-history")).not.toHaveClass(/active/);
  });
});
