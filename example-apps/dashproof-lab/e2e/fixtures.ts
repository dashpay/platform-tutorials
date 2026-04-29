import { test as base, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export { expect };

export interface DashproofFixtures {
  randomFilePayload: { name: string; mimeType: string; buffer: Buffer };
  fixtureFile: (filename: string) => {
    name: string;
    mimeType: string;
    buffer: Buffer;
  };
}

export const test = base.extend<DashproofFixtures>({
  randomFilePayload: async ({ browserName }, provide) => {
    void browserName;
    const bytes = Buffer.alloc(1024);
    for (let i = 0; i < bytes.length; i += 1)
      bytes[i] = Math.floor(Math.random() * 256);
    const stamp = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    await provide({
      name: `dashproof-e2e-${stamp}-${rand}.bin`,
      mimeType: "application/octet-stream",
      buffer: bytes,
    });
  },
  fixtureFile: async ({ browserName }, provide) => {
    void browserName;
    await provide((filename: string) => {
      const path = resolve(__dirname, "../public/example-files", filename);
      return {
        name: filename,
        mimeType: filename.endsWith(".csv")
          ? "text/csv"
          : filename.endsWith(".json")
            ? "application/json"
            : "text/plain",
        buffer: readFileSync(path),
      };
    });
  },
});

export const HAS_MNEMONIC = Boolean(process.env.PLATFORM_MNEMONIC?.trim());

export async function waitForBrowsingReady(page: Page) {
  // The sidebar IdentityCard shows "Connected" once createClient resolves.
  // Without this gate, panel queries (verify/history) skip the network call
  // because session.sdk is still null.
  await expect(page.getByText(/^(Connected|Authenticated)$/)).toBeVisible({
    timeout: 30_000,
  });
}

const navLink = (page: Page, label: string) =>
  page
    .locator('aside[aria-label="Main navigation"]')
    .getByRole("button", { name: new RegExp(`${label}$`) });

// Click a sidebar nav link without navigating away from the current page.
// Use this after loginViaModal so the auth state isn't wiped by a reload.
export async function clickNav(
  page: Page,
  label: "Create proof" | "Verify proof" | "History",
) {
  await navLink(page, label).click();
}

export async function gotoAnchor(page: Page) {
  await page.goto("/");
  await waitForBrowsingReady(page);
  await navLink(page, "Create proof").click();
}

export async function gotoVerify(page: Page) {
  await page.goto("/");
  await waitForBrowsingReady(page);
  await navLink(page, "Verify proof").click();
}

export async function gotoHistory(page: Page) {
  await page.goto("/");
  await waitForBrowsingReady(page);
  await navLink(page, "History").click();
}

// Opens the LoginModal via the sidebar "Login" nav button, fills the mnemonic
// from PLATFORM_MNEMONIC, and waits for the authenticated-state signal in the
// sidebar IdentityCard. Caller is responsible for skipping when HAS_MNEMONIC
// is false.
export async function loginViaModal(page: Page) {
  const mnemonic = process.env.PLATFORM_MNEMONIC;
  if (!mnemonic)
    throw new Error("PLATFORM_MNEMONIC is required for loginViaModal");

  // Wait for the SDK to connect before clicking Login. Once connected,
  // IdentityCard stops rendering its own "Login" button, leaving only the
  // sidebar nav "→ Login" — so /Login$/ matches a single element.
  await waitForBrowsingReady(page);
  await navLink(page, "Login").click();

  const mnemonicInput = page.getByPlaceholder("mnemonic phrase");
  await expect(mnemonicInput).toBeVisible();
  await mnemonicInput.fill(mnemonic);
  await page.getByRole("button", { name: /Login and continue/ }).click();

  await expect(page.getByText("Authenticated", { exact: true })).toBeVisible();
}
