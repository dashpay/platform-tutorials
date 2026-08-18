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

interface QueryPage {
  notes: NoteRecord[];
  resultCount: number;
  lastId: string | null;
}

/**
 * Flatten an SDK query result into notes while preserving server order and the
 * raw page size. `lastId` always comes from the final server-ordered entry
 * before any client-side sorting — Map/object keys first, otherwise the
 * document's own id.
 */
function queryPage(results: DashNoteQueryResults): QueryPage {
  if (Array.isArray(results)) {
    const notes: NoteRecord[] = [];
    for (const document of results) {
      if (!document) continue;
      notes.push(toNote(null, document as DashNoteQueryDocument));
    }
    return {
      notes,
      resultCount: results.length,
      lastId: notes.at(-1)?.id || null,
    };
  }

  const rawEntries =
    results instanceof Map
      ? Array.from(results.entries())
      : Object.entries(results);
  const notes: NoteRecord[] = [];
  for (const [id, document] of rawEntries) {
    if (!document) continue;
    notes.push(toNote(id, document as DashNoteQueryDocument));
  }
  return {
    notes,
    resultCount: rawEntries.length,
    lastId: rawEntries.at(-1)?.[0] ?? null,
  };
}

export function normalizeNotes(results: DashNoteQueryResults): NoteRecord[] {
  return queryPage(results).notes;
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
  log,
}: {
  sdk: DashSdk;
  contractId: string;
  ownerId: string;
  startAfter?: string;
  limit?: number;
  log?: Logger;
}): Promise<NotePage> {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_QUERY_LIMIT) {
    throw new RangeError(
      `Note page size must be an integer from 1 to ${MAX_QUERY_LIMIT}.`,
    );
  }

  log?.(startAfter ? "Loading next page of notes…" : "Loading your notes…");
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
  const page = queryPage(results);
  const nextCursor = page.resultCount === limit ? page.lastId : null;

  if (page.resultCount === limit && !nextCursor) {
    throw new Error("Document query page did not expose a cursor ID.");
  }
  if (nextCursor && nextCursor === startAfter) {
    throw new Error("Document pagination made no progress.");
  }

  return {
    notes: page.notes,
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
  const notesById = new Map<string, NoteRecord>();
  const seenCursors = new Set<string>();
  let startAfter: string | undefined;

  for (;;) {
    const page = await listMyNotesPage({
      sdk,
      contractId,
      ownerId,
      startAfter,
      limit,
      log,
    });

    for (const note of page.notes) {
      if (!notesById.has(note.id)) notesById.set(note.id, note);
    }

    if (!page.nextCursor) break;
    if (seenCursors.has(page.nextCursor)) {
      throw new Error("Document pagination repeated a cursor.");
    }
    seenCursors.add(page.nextCursor);
    startAfter = page.nextCursor;
  }

  return [...notesById.values()].sort(
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
