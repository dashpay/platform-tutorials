/**
 * Looks up the DPNS username registered to an identity, with the `.dash`
 * TLD stripped for display.
 *
 * SDK method: sdk.dpns.username(identityId)
 */
import type { DashSdk } from "./types";

export async function lookupDpnsName(
  sdk: DashSdk,
  identityId: string,
): Promise<string | null> {
  const result = await sdk.dpns.username(identityId);
  if (typeof result !== "string" || result.length === 0) return null;
  return result.endsWith(".dash") ? result.slice(0, -5) : result;
}

/**
 * Safe DPNS username lookup for optional display labels.
 *
 * Returns null if the identity has no name registered, the lookup fails,
 * or the SDK returns a non-string value.
 */
export async function resolveDpnsName(
  sdk: DashSdk,
  identityId: string,
): Promise<string | null> {
  try {
    return await lookupDpnsName(sdk, identityId);
  } catch {
    return null;
  }
}
