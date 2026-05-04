// Persists ONLY the identity ID and (optionally) its DPNS username for the
// most recently logged-in user, so a returning visitor can browse their
// notes read-only and see their name without re-querying. Never store the
// mnemonic, derived keys, or identity index here.
const STORAGE_KEY = "dashnote.lastIdentity";

export interface RememberedIdentity {
  id: string;
  name?: string | null;
}

export function loadRememberedIdentity(): RememberedIdentity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedIdentity>;
    if (typeof parsed?.id !== "string" || !parsed.id) return null;
    return {
      id: parsed.id,
      name: typeof parsed.name === "string" ? parsed.name : null,
    };
  } catch {
    return null;
  }
}

export function saveRememberedIdentity(value: RememberedIdentity): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore — quota or disabled storage
  }
}

export function clearRememberedIdentity(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
