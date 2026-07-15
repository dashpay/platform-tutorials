/**
 * Contract ID persistence + owner lookup. Split from contract.ts so the
 * session bootstrap can import these helpers without dragging the
 * @dashevo/evo-sdk module (and its WASM bundle) into the entry chunk.
 *
 * SDK method (fetchContractOwnerId): sdk.contracts.fetch(...)
 *
 * localStorage access is best-effort: restricted contexts (SecurityError,
 * QuotaExceededError, missing storage) must not prevent the app from
 * mounting or discard a successfully published contract ID. Callers still
 * keep the in-memory / returned ID when persistence fails.
 */
import type { DashSdk } from "./types";

const STORAGE_KEY = "token-ops.contractId";

/**
 * Default contract ID baked into the tutorial so browse-only mode works on a
 * fresh machine without any setup. Users can override it in Settings or
 * register their own contract.
 */
export const DEFAULT_CONTRACT_ID: string | null =
  "KMMJJdJo9LTjjevsuJ4jkbNZEY8xCq8n44cDmba7o2A";

export function loadStoredContractId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_CONTRACT_ID;
  } catch {
    return DEFAULT_CONTRACT_ID;
  }
}

export function saveContractId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Persistence is best-effort; callers still retain the contract ID.
  }
}

export function clearStoredContractId(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Persistence is best-effort; callers can still restore the fallback.
  }
}

export async function fetchContractOwnerId({
  sdk,
  contractId,
}: {
  sdk: DashSdk;
  contractId: string;
}): Promise<string | null> {
  const contract = await sdk.contracts.fetch(contractId);
  if (!contract) return null;
  const json =
    typeof contract.toJSON === "function" ? contract.toJSON() : contract;
  const ownerId = json.$ownerId ?? json.ownerId ?? null;
  return ownerId ? String(ownerId) : null;
}
