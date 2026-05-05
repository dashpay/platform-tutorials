import type { DashAuth, DashKeyManager } from "../dash/types";

/**
 * Build a DashKeyManager-shaped object from a pre-resolved auth triple.
 *
 * Used by the WIF login flow: `loginWithPrivateKey` already located the
 * identity and built a one-key signer, so getAuth() just hands the cached
 * triple back. This lets `src/dash/*` helpers consume WIF-based sessions
 * without a separate code path.
 */
export function keyManagerFromKey(
  identityId: string,
  auth: DashAuth,
): DashKeyManager {
  return {
    identityId,
    getAuth: async () => auth,
  };
}
