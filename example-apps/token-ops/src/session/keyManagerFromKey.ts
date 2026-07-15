import type { DashAuth, DashKeyManager } from "../dash/types";

export function keyManagerFromKey(
  identityId: string,
  auth: DashAuth,
): DashKeyManager {
  return {
    identityId,
    getAuth: async () => auth,
  };
}
