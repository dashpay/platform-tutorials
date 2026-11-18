import { requireId } from "./ids";
import type { ReadSdk } from "./types";
import { toDocumentArray, type DocumentHandle } from "../lib/safeDoc";

/** `in` accepts at most 100 values. */
export const MAX_IN_VALUES = 100;

export function documentId(document: DocumentHandle) {
  const object =
    (
      document as DocumentHandle & {
        toObject?: () => Record<string, unknown>;
      }
    ).toObject?.() ?? {};
  return requireId(document.id ?? object.$id);
}

/** Parse what can be parsed; a malformed document is skipped, not fatal. */
export function parseEach<T>(
  documents: DocumentHandle[],
  parse: (document: DocumentHandle) => T,
) {
  return documents.flatMap((document) => {
    try {
      return [parse(document)];
    } catch {
      return [];
    }
  });
}

export function chunks<T>(values: T[], size = MAX_IN_VALUES) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    result.push(values.slice(index, index + size));
  return result;
}

/**
 * One server-ordered page; don't re-sort it. Asks for `limit + 1` so the
 * extra row only says whether another page exists, and returns the last row
 * shown as the next document-ID `startAfter`.
 */
export async function queryPage<T>(
  sdk: ReadSdk,
  args: Omit<Parameters<ReadSdk["documents"]["query"]>[0], "limit">,
  parse: (document: DocumentHandle) => T,
  limit: number,
  cursor?: string,
): Promise<{ items: T[]; cursor?: string }> {
  const startAfter = cursor ? requireId(cursor) : undefined;
  const documents = toDocumentArray(
    await sdk.documents.query({
      ...args,
      limit: limit + 1,
      ...(startAfter ? { startAfter } : {}),
    }),
  );
  const shown = documents.slice(0, limit);
  const next =
    documents.length > limit ? documentId(shown[shown.length - 1]) : undefined;
  if (next && next === startAfter)
    throw new Error("Pagination cursor did not advance.");
  return { items: parseEach(shown, parse), cursor: next };
}
