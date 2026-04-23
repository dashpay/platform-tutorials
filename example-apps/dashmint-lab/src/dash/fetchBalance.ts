/**
 * Fetch an identity's credit balance.
 *
 * SDK method: sdk.identities.balance(identityId) returns a bigint.
 */
import type { DashSdk } from "./types";

export function fetchBalance(
  sdk: DashSdk,
  identityId: string,
): Promise<bigint> {
  return sdk.identities.balance(identityId);
}
