/**
 * Shared Playwright fixtures for TokenOps E2E tests.
 *
 * These run against real Dash Platform testnet. No mocks — the app boots
 * normally and connects via @dashevo/evo-sdk.
 *
 * Two independent gates:
 *   HAS_MNEMONIC — PLATFORM_MNEMONIC is set. Enough for single-identity flows.
 *   HAS_GROUP_IDENTITIES — all group member IDs from
 *     scripts/bootstrap-identities.mjs are present. Required for group
 *     2-of-3 signing flow, which needs a genuinely different signing
 *     identity for the second signature. This is a stricter, separate gate
 *     from HAS_MNEMONIC so casual contributors/CI aren't blocked by the
 *     heavier 4-identity setup cost.
 */
import { test as base, expect, type Page } from "@playwright/test";

interface AppFixture {
  page: Page;
}

export const test = base.extend<AppFixture>({
  page: async ({ page }, provide) => {
    await page.goto("/");
    await provide(page);
  },
});

export { expect, type Page };

export const HAS_MNEMONIC = Boolean(process.env.PLATFORM_MNEMONIC?.trim());

export const GROUP_MEMBER_IDS = [
  process.env.VITE_TOKEN_OPS_MEMBER_1_ID,
  process.env.VITE_TOKEN_OPS_MEMBER_2_ID,
  process.env.VITE_TOKEN_OPS_MEMBER_3_ID,
].filter((id): id is string => Boolean(id?.trim()));

export const HAS_GROUP_IDENTITIES =
  HAS_MNEMONIC && GROUP_MEMBER_IDS.length === 3;

/**
 * Sign in via the top-bar modal with PLATFORM_MNEMONIC at the given identity
 * index. Caller should `test.skip(!HAS_MNEMONIC, …)` first.
 */
export async function loginAs(page: Page, identityIndex: number) {
  const mnemonic = process.env.PLATFORM_MNEMONIC?.trim();
  if (!mnemonic) throw new Error("PLATFORM_MNEMONIC is required for loginAs");

  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sign in to TokenOps" });
  await dialog.getByLabel("Mnemonic or private key").fill(mnemonic);
  await dialog.getByRole("button", { name: "Show advanced settings" }).click();
  await dialog.getByLabel(/identity index/i).fill(String(identityIndex));
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible({
    timeout: 60_000,
  });
}

/**
 * Sign in via the top-bar modal with a WIF private key. The modal hides the
 * mnemonic-only "advanced settings" toggle for WIF-shaped input, and no
 * identity index applies — the identity is whichever holds the key. Caller
 * should `test.skip(!HAS_MNEMONIC, …)` first (the WIF is derived from the
 * mnemonic — see deriveWifFromMnemonic).
 */
export async function loginWithWif(page: Page, wif: string) {
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sign in to TokenOps" });
  await dialog.getByLabel("Mnemonic or private key").fill(wif);
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible({
    timeout: 60_000,
  });
}

/**
 * Derive a WIF private key from PLATFORM_MNEMONIC for the given identity/key
 * index, using the same DIP-13 derivation the app's key manager uses. Runs in
 * the Node test process (not the browser). Key index 2 is the CRITICAL auth
 * key, which satisfies loginWithPrivateKey's AUTHENTICATION-at-HIGH/CRITICAL
 * gate — the same key the app signs with. This lets one funded mnemonic drive
 * both the mnemonic- and WIF-login e2e paths for the same identity.
 */
export async function deriveWifFromMnemonic(
  identityIndex = 0,
  keyIndex = 2,
): Promise<string> {
  const mnemonic = process.env.PLATFORM_MNEMONIC?.trim();
  if (!mnemonic) {
    throw new Error("PLATFORM_MNEMONIC is required to derive a WIF");
  }
  // Import from the repo-root SDK copy (matching scripts/bootstrap-identities.mjs).
  // Build the DIP-13 path from the same wallet instance so derivation matches
  // the app's key manager exactly (setupDashClient-core.mjs#dip13KeyPath).
  const { wallet } = await import(
    "../../../../node_modules/@dashevo/evo-sdk/dist/evo-sdk.module.js"
  );

  const network = "testnet";
  const base = await wallet.derivationPathDip13Testnet(5);
  const path = `${base.path}/0'/0'/${identityIndex}'/${keyIndex}'`;
  const derived = await wallet.deriveKeyFromSeedWithPath({
    mnemonic,
    path,
    network,
  });
  const wif: string = derived.toObject().privateKeyWif;
  if (!wif) throw new Error("WIF derivation returned no privateKeyWif");
  return wif;
}
