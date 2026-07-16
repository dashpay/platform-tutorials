/**
 * Read-side queries against the note contract.
 *
 * SDK methods:
 *   sdk.documents.query({
 *     dataContractId,
 *     documentTypeName,
 *     where,
 *     orderBy,
 *     limit,
 *     startAfter,
 *   })
 *   sdk.documents.get(contractId, documentTypeName, documentId)
 */
import type { Logger } from "../lib/logger";
import type {
  DashDocumentLike,
  DashNoteQueryDocument,
  DashNoteQueryJson,
  DashNoteQueryResults,
  DashSdk,
} from "./types";

const MAX_QUERY_LIMIT = 100;

export interface NoteRecord {
  id: string;
  ownerId: string;
  title: string | null;
  message: string;
  createdAt: number | null;
  updatedAt: number | null;
  revision: number;
}

function toTimestamp(
  value: DashNoteQueryJson["$createdAt"] | DashNoteQueryJson["$updatedAt"],
): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toRevision(
  value: number | string | bigint | undefined,
  fallback?: number | string | bigint,
): number {
  const raw = value ?? fallback;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "bigint") return Number(raw);
  if (typeof raw === "string" && raw) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toNote(id: string | null, raw: DashNoteQueryDocument): NoteRecord {
  const json: DashNoteQueryJson =
    typeof raw?.toJSON === "function" ? raw.toJSON() : raw;
  return {
    id: String(id ?? json.$id ?? json.id ?? ""),
    ownerId: String(json.$ownerId ?? ""),
    title: typeof json.title === "string" ? json.title : null,
    message: typeof json.message === "string" ? json.message : "",
    createdAt: toTimestamp(json.$createdAt),
    updatedAt: toTimestamp(json.$updatedAt),
    revision: toRevision(json.$revision, raw.revision),
  };
}

interface QueryPageEntries {
  entries: Array<[string | null, DashNoteQueryDocument]>;
  resultCount: number;
  lastId: string | null;
}

function queryPageEntries(results: DashNoteQueryResults): QueryPageEntries {
  if (Array.isArray(results)) {
    const documents = results.filter(Boolean) as DashNoteQueryDocument[];
    const last = documents.at(-1);
    return {
      entries: documents.map((document) => [null, document]),
      resultCount: results.length,
      lastId: last ? toNote(null, last).id || null : null,
    };
  }

  const entries =
    results instanceof Map ? Array.from(results.entries()) : Object.entries(results);
  return {
    entries: entries
      .filter((entry): entry is [string, DashNoteQueryDocument] =>
        Boolean(entry[1]),
      )
      .map(([id, document]) => [id, document]),
    resultCount: entries.length,
    // The cursor must come from the last entry in the SDK's server-ordered
    // result, before any client-side sorting or filtering.
    lastId: entries.at(-1)?.[0] ?? null,
  };
}

export function normalizeNotes(results: DashNoteQueryResults): NoteRecord[] {
  return queryPageEntries(results).entries.map(([id, document]) =>
    toNote(id, document),
  );
}

export function normalizeSingleNote(
  id: string,
  raw: DashDocumentLike | undefined,
): NoteRecord | null {
  if (!raw) return null;
  return toNote(id, raw as DashNoteQueryDocument);
}

export interface NotePage {
  notes: NoteRecord[];
  nextCursor: string | null;
}

/**
 * Fetch one index-ordered page. `startAfter` is an exclusive document-ID
 * cursor, so the next page starts immediately after the final entry returned by
 * the previous query.
 */
export async function listMyNotesPage({
  sdk,
  contractId,
  ownerId,
  startAfter,
  limit = MAX_QUERY_LIMIT,
}: {
  sdk: DashSdk;
  contractId: string;
  ownerId: string;
  startAfter?: string;
  limit?: number;
}): Promise<NotePage> {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_QUERY_LIMIT) {
    throw new RangeError(
      `Note page size must be an integer from 1 to ${MAX_QUERY_LIMIT}.`,
    );
  }

  const results = await sdk.documents.query({
    dataContractId: contractId,
    documentTypeName: "note",
    where: [["$ownerId", "==", ownerId]],
    // Traverse the immutable creation-time index so editing a note between page
    // requests cannot move it across the cursor boundary. The completed list is
    // still sorted by $updatedAt for the existing recent-notes UX.
    orderBy: [
      ["$ownerId", "asc"],
      ["$createdAt", "asc"],
    ],
    limit,
    ...(startAfter ? { startAfter } : {}),
  });
  const page = queryPageEntries(results);
  const nextCursor = page.resultCount === limit ? page.lastId : null;

  if (page.resultCount === limit && !nextCursor) {
    throw new Error("Document query page did not expose a cursor ID.");
  }
  if (nextCursor && nextCursor === startAfter) {
    throw new Error("Document pagination made no progress.");
  }

  return {
    notes: page.entries.map(([id, document]) => toNote(id, document)),
    nextCursor,
  };
}

/**
 * Walk every page with the SDK's exclusive `startAfter` cursor. Pages stay in
 * server index order until their cursor has been captured; only the completed
 * list is sorted newest-first for display.
 */
export async function listMyNotes({
  sdk,
  contractId,
  ownerId,
  limit = MAX_QUERY_LIMIT,
  log,
}: {
  sdk: DashSdk;
  contractId: string;
  ownerId: string;
  limit?: number;
  log?: Logger;
}): Promise<NoteRecord[]> {
  log?.("Loading your notes…");
  const notes: NoteRecord[] = [];
  const seenNoteIds = new Set<string>();
  const seenCursors = new Set<string>();
  let startAfter: string | undefined;

  for (;;) {
    const page = await listMyNotesPage({
      sdk,
      contractId,
      ownerId,
      startAfter,
      limit,
    });

    for (const note of page.notes) {
      if (seenNoteIds.has(note.id)) continue;
      seenNoteIds.add(note.id);
      notes.push(note);
    }

    if (!page.nextCursor) break;
    if (seenCursors.has(page.nextCursor)) {
      throw new Error("Document pagination repeated a cursor.");
    }
    seenCursors.add(page.nextCursor);
    startAfter = page.nextCursor;
  }

  return notes.sort(
    (left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0),
  );
}

export async function getNote({
  sdk,
  contractId,
  noteId,
  log,
}: {
  sdk: DashSdk;
  contractId: string;
  noteId: string;
  log?: Logger;
}): Promise<NoteRecord | null> {
  log?.(`Loading note ${noteId}…`);
  const result = await sdk.documents.get(contractId, "note", noteId);
  return normalizeSingleNote(noteId, result);
}
