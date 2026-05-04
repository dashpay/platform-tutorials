// Caches the user's note list (titles, bodies, revisions) in localStorage so a
// returning visitor sees their notes paint instantly on reload, before the
// background revalidation against Platform completes. Keyed by identity so
// switching identities never mixes data. Invalidated when the contract or
// network changes.
import type { NoteRecord } from "../dash/queries";

const STORAGE_PREFIX = "dashnote.notes.";
const SCHEMA_VERSION = 1;

export const BACKGROUND_REFRESH_MS = 30_000;
export const FOCUS_REFRESH_MIN_MS = 10_000;

type Network = "testnet" | "mainnet";

interface CachedWorkspace {
  version: typeof SCHEMA_VERSION;
  identityId: string;
  contractId: string;
  network: Network;
  cachedAt: number;
  notes: NoteRecord[];
}

function storageKey(identityId: string): string {
  return `${STORAGE_PREFIX}${identityId}`;
}

export function loadCachedNotes(
  identityId: string,
  contractId: string,
  network: Network,
): NoteRecord[] | null {
  if (!identityId || !contractId) return null;
  try {
    const raw = localStorage.getItem(storageKey(identityId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedWorkspace>;
    if (
      parsed.version !== SCHEMA_VERSION ||
      parsed.identityId !== identityId ||
      parsed.contractId !== contractId ||
      parsed.network !== network ||
      !Array.isArray(parsed.notes)
    ) {
      localStorage.removeItem(storageKey(identityId));
      return null;
    }
    return parsed.notes as NoteRecord[];
  } catch {
    try {
      localStorage.removeItem(storageKey(identityId));
    } catch {
      // ignore
    }
    return null;
  }
}

export function saveCachedNotes(
  identityId: string,
  contractId: string,
  network: Network,
  notes: NoteRecord[],
): void {
  if (!identityId || !contractId) return;
  const payload: CachedWorkspace = {
    version: SCHEMA_VERSION,
    identityId,
    contractId,
    network,
    cachedAt: Date.now(),
    notes,
  };
  try {
    localStorage.setItem(storageKey(identityId), JSON.stringify(payload));
  } catch {
    // ignore — quota or disabled storage
  }
}

export function clearCachedNotes(identityId: string): void {
  if (!identityId) return;
  try {
    localStorage.removeItem(storageKey(identityId));
  } catch {
    // ignore
  }
}

export function notesEqualByRevision(
  a: NoteRecord[],
  b: NoteRecord[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].id !== b[i].id || a[i].revision !== b[i].revision) return false;
  }
  return true;
}
