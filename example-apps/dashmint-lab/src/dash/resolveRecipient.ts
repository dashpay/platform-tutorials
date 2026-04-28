/**
 * Resolves a DPNS name (e.g. "alice", "Alice.dash") to an identity ID.
 *
 * Lowercases the input and appends ".dash" if missing, since DPNS stores
 * normalized labels and `sdk.dpns.resolveName` expects the full name.
 * Returns null when the name has no record. Real SDK/network errors
 * propagate so callers can distinguish a confirmed "not found" from a
 * transient failure.
 *
 * SDK method: sdk.dpns.resolveName(name)
 */
import type { DashSdk } from "./types";

export async function resolveDpnsName(
  sdk: DashSdk,
  input: string,
): Promise<string | null> {
  const fullName = normalizeDpnsName(input);
  const id = await sdk.dpns.resolveName(fullName);
  if (typeof id !== "string" || !id) return null;
  return id;
}

export function normalizeDpnsName(input: string): string {
  const lower = input.trim().toLowerCase();
  return lower.endsWith(".dash") ? lower : `${lower}.dash`;
}
