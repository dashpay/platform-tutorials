// Persists ONLY the identity ID of the most recently logged-in user so a
// returning visitor can browse their notes read-only without re-entering a
// mnemonic. Never store the mnemonic, derived keys, or identity index here.
const STORAGE_KEY = "patchbook-lab.lastIdentityId";

export function loadRememberedIdentityId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveRememberedIdentityId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore — quota or disabled storage
  }
}

export function clearRememberedIdentityId(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
