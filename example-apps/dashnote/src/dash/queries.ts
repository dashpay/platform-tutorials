/**
 * Read-side queries against the note contract.
 *
 * SDK methods:
 *   sdk.documents.query({ dataContractId, documentTypeName, where, orderBy, limit })
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

export function normalizeNotes(results: DashNoteQueryResults): NoteRecord[] {
  if (Array.isArray(results)) {
    return results
      .filter(Boolean)
      .map((doc) => toNote(null, doc as DashNoteQueryDocument));
  }
  const entries =
    results instanceof Map ? Object.fromEntries(results) : results;
  return Object.entries(entries)
    .filter(([, doc]) => Boolean(doc))
    .map(([id, doc]) => toNote(id, doc as DashNoteQueryDocument));
}

export function normalizeSingleNote(
  id: string,
  raw: DashDocumentLike | undefined,
): NoteRecord | null {
  if (!raw) return null;
  return toNote(id, raw as DashNoteQueryDocument);
}

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
  const results = await sdk.documents.query({
    dataContractId: contractId,
    documentTypeName: "note",
    where: [["$ownerId", "==", ownerId]],
    orderBy: [
      ["$ownerId", "asc"],
      ["$updatedAt", "asc"],
    ],
    limit,
  });

  return normalizeNotes(results).sort(
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
