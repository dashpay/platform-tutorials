/**
 * Looks up the DPNS username registered to an identity, with the `.dash`
 * suffix stripped for compact display.
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
