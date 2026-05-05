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

function storageKey(
  identityId: string,
  contractId: string,
  network: Network,
): string {
  return `${STORAGE_PREFIX}${identityId}.${contractId}.${network}`;
}

// Prefix for every cache entry belonging to a single identity, regardless
// of which contract/network it was scoped to. Used by clearCachedNotes
// when the caller doesn't know (or care about) the contract+network.
function identityPrefix(identityId: string): string {
  return `${STORAGE_PREFIX}${identityId}.`;
}

export function loadCachedNotes(
  identityId: string,
  contractId: string,
  network: Network,
): NoteRecord[] | null {
  if (!identityId || !contractId) return null;
  const key = storageKey(identityId, contractId, network);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedWorkspace>;
    if (
      parsed.version !== SCHEMA_VERSION ||
      parsed.identityId !== identityId ||
      parsed.contractId !== contractId ||
      parsed.network !== network ||
      !Array.isArray(parsed.notes)
    ) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.notes as NoteRecord[];
  } catch {
    try {
      localStorage.removeItem(key);
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
    localStorage.setItem(
      storageKey(identityId, contractId, network),
      JSON.stringify(payload),
    );
  } catch {
    // ignore — quota or disabled storage
  }
}

// Clears every cached workspace for `identityId` across all contract/network
// combinations. Forget-identity / logout flows don't know which combos the
// user has visited, so we sweep by prefix.
export function clearCachedNotes(identityId: string): void {
  if (!identityId) return;
  try {
    const prefix = identityPrefix(identityId);
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
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
