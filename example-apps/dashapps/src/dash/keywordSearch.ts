import { requireId } from "./ids";
import { toDocumentArray } from "../lib/safeDoc";
import type { ReadSdk } from "./types";
export const KEYWORD_CONTRACT_ID =
  "BsjE6tQxG47wffZCRQCovFx5rYrAYYC3rTVRWKro27LA";
export async function searchKeywords(
  sdk: ReadSdk,
  keyword: string,
  cursor?: string,
) {
  const term = keyword.trim().toLowerCase();
  if (term.length < 3 || term.length > 50)
    throw new Error("Use a keyword of 3–50 characters.");
  const docs = toDocumentArray(
    await sdk.documents.query({
      dataContractId: KEYWORD_CONTRACT_ID,
      documentTypeName: "contractKeywords",
      where: [["keyword", "==", term]],
      limit: 100,
      ...(cursor ? { startAfter: requireId(cursor) } : {}),
    }),
  );
  return {
    ids: [...new Set(docs.map((doc) => requireId(doc.properties?.contractId)))],
    cursor: docs.length === 100 ? requireId(docs.at(-1)?.id) : undefined,
  };
}
// Query filters pass through JSON; use base58 for identifier properties, not Uint8Array.
export async function shortDescription(sdk: ReadSdk, id: string) {
  const docs = toDocumentArray(
    await sdk.documents.query({
      dataContractId: KEYWORD_CONTRACT_ID,
      documentTypeName: "shortDescription",
      where: [["contractId", "==", requireId(id)]],
      limit: 1,
    }),
  );
  const value = docs[0]?.properties?.description;
  if (value != null && typeof value !== "string")
    throw new Error("Malformed short description.");
  return value as string | undefined;
}
