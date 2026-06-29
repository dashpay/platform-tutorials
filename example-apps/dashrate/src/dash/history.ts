/**
 * Review history query helper.
 *
 * SDK method:
 *   sdk.documents.history({ dataContractId, documentTypeName, documentId, startAtMs, limit })
 */
import type { DashDocumentLike, DashReviewQueryJson, DashSdk } from "./types";

export const REVIEW_HISTORY_LIMIT = 10;

export interface ReviewHistoryEntry {
  blockTimeMs: number;
  revision: number;
  rating: number;
  reviewText: string;
}

export function normalizeHistory(
  history: Map<bigint, DashDocumentLike>,
): ReviewHistoryEntry[] {
  return Array.from(history.entries())
    .map(([blockTimeKey, document]) => {
      const json: DashReviewQueryJson =
        typeof document.toJSON === "function"
          ? (document.toJSON() as DashReviewQueryJson)
          : (document as DashReviewQueryJson);
      return {
        blockTimeMs: Number(blockTimeKey),
        revision: Number(json.$revision ?? document.revision ?? 0),
        rating: Number(json.rating ?? 0),
        reviewText: typeof json.reviewText === "string" ? json.reviewText : "",
      };
    })
    .sort((left, right) => right.blockTimeMs - left.blockTimeMs);
}

export async function fetchReviewHistory({
  sdk,
  contractId,
  reviewId,
  startAtMs = 0,
  limit = REVIEW_HISTORY_LIMIT,
}: {
  sdk: DashSdk;
  contractId: string;
  reviewId: string;
  startAtMs?: number;
  limit?: number;
}): Promise<ReviewHistoryEntry[]> {
  const history = await sdk.documents.history({
    dataContractId: contractId,
    documentTypeName: "review",
    documentId: reviewId,
    startAtMs,
    limit: Math.min(Math.max(1, limit), REVIEW_HISTORY_LIMIT),
  });
  return normalizeHistory(history);
}
