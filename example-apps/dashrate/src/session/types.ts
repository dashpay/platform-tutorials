import type { DashKeyManager, DashSdk } from "../dash/types";

export interface Session {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  identityId: string;
}
