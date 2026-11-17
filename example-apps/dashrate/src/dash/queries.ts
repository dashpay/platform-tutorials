/**
 * Read-side queries for one resource's ratings and reviews.
 *
 * SDK methods:
 *   sdk.documents.average(...)      // proven (count, sum) per resource
 *   sdk.documents.count(...)        // grouped: GROUP BY rating (histogram)
 *   sdk.documents.query(...)        // newest-first pages ($updatedAt desc + startAfter)
 *
 * Cross-resource rankings (documents.ranked / documents.having) live in
 * leaderboard.ts.
 */
import { consoleLogger, errorMessage, type Logger } from "../lib/logger";
import type {
  DashDocumentLike,
  DashReviewQueryDocument,
  DashReviewQueryJson,
  DashReviewQueryResults,
  DashSdk,
} from "./types";

export interface ReviewRecord {
  id: string;
  ownerId: string;
  resourceId: string;
  rating: number;
  reviewText: string;
  createdAt: number | null;
  updatedAt: number | null;
  revision: number;
}

export interface RatingSummary {
  resourceId: string;
  count: bigint;
  sum: bigint;
  average: number | null;
}

/** Per-star review counts for a resource, keyed by rating value 1–5. */
export type RatingDistribution = Record<number, bigint>;

/** Page size for a resource's review list ("Load more" fetches the next). */
export const REVIEW_PAGE_SIZE = 10;
const MY_REVIEWS_LIMIT = 50;

/** The valid rating values, used to build distribution lookup keys. */
const RATING_VALUES = [1, 2, 3, 4, 5] as const;

export function firstMapValue<T>(map: Map<string, T>): T | undefined {
  return map.values().next().value as T | undefined;
}

/**
 * Decode a grouped `count` result-map key back to its rating, or null if
 * the key isn't a valid rating.
 *
 * Keys are the hex of the raw index-key bytes, not the value. `rating`
 * (integer 1–5) is stored as a single unsigned byte holding the value, so
 * rating 5 → `0x05` → "05".
 */
export function ratingFromKeyHex(key: string): number | null {
  if (!/^[0-9a-f]{2}$/i.test(key)) return null;
  const rating = parseInt(key, 16);
  return (RATING_VALUES as readonly number[]).includes(rating) ? rating : null;
}

function toTimestamp(
  value: DashReviewQueryJson["$createdAt"] | DashReviewQueryJson["$updatedAt"],
): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toReview(
  id: string | null,
  raw: DashReviewQueryDocument,
): ReviewRecord {
  const json: DashReviewQueryJson =
    typeof raw?.toJSON === "function" ? raw.toJSON() : raw;
  return {
    id: String(id ?? json.$id ?? json.id ?? ""),
    ownerId: String(json.$ownerId ?? ""),
    resourceId: String(json.resourceId ?? ""),
    rating: toNumber(json.rating),
    reviewText: typeof json.reviewText === "string" ? json.reviewText : "",
    createdAt: toTimestamp(json.$createdAt),
    updatedAt: toTimestamp(json.$updatedAt),
    revision: toNumber(json.$revision, toNumber(raw.revision)),
  };
}

export function normalizeReviews(
  results: DashReviewQueryResults,
): ReviewRecord[] {
  if (Array.isArray(results)) {
    return results
      .filter(Boolean)
      .map((doc) => toReview(null, doc as DashReviewQueryDocument));
  }
  const entries =
    results instanceof Map ? Object.fromEntries(results) : results;
  return Object.entries(entries)
    .filter(([, doc]) => Boolean(doc))
    .map(([id, doc]) => toReview(id, doc as DashReviewQueryDocument));
}

export function normalizeSingleReview(
  id: string,
  raw: DashDocumentLike | undefined,
): ReviewRecord | null {
  if (!raw) return null;
  return toReview(id, raw as DashReviewQueryDocument);
}

function resourceAggregateQuery(contractId: string, resourceId: string) {
  return {
    dataContractId: contractId,
    documentTypeName: "review",
    where: [["resourceId", "==", resourceId]],
    orderBy: [["resourceId", "asc"]] as [string, "asc" | "desc"][],
  };
}

/**
 * Count, sum and average rating for a resource — one proven
 * `documents.average` point lookup on the `averageable` [resourceId] index.
 * The network returns the raw integers (not a pre-divided average), so both
 * are exact; the average is divided here.
 *
 * The ungrouped result is a one-entry map keyed "". A resource with no
 * reviews returns an EMPTY map (not `"" → {0n, 0n}`), so the zero fallback is
 * required.
 */
export async function getRatingSummary({
  sdk,
  contractId,
  resourceId,
  log = consoleLogger,
}: {
  sdk: DashSdk;
  contractId: string;
  resourceId: string;
  log?: Logger;
}): Promise<RatingSummary> {
  try {
    const result = await sdk.documents.average(
      resourceAggregateQuery(contractId, resourceId),
      "rating",
    );
    const { count, sum } = result.get("") ??
      firstMapValue(result) ?? { count: 0n, sum: 0n };
    const average = count > 0n ? Number(sum) / Number(count) : null;
    return { resourceId, count, sum, average };
  } catch (err) {
    log(
      `Average query failed for ${resourceId}: ${errorMessage(err)}`,
      "error",
    );
    throw err;
  }
}

/**
 * Per-star review counts for a resource, from a single grouped count
 * query: `count` GROUP BY `rating` over the `[resourceId, rating]`
 * index. The `between` range on `rating` is what puts the query in
 * RangeDistinct mode (one map entry per distinct rating); the
 * `resourceId == X` equality prefix scopes it to this resource.
 */
export async function getRatingDistribution({
  sdk,
  contractId,
  resourceId,
  log = consoleLogger,
}: {
  sdk: DashSdk;
  contractId: string;
  resourceId: string;
  log?: Logger;
}): Promise<RatingDistribution> {
  try {
    const counts = await sdk.documents.count({
      dataContractId: contractId,
      documentTypeName: "review",
      where: [
        ["resourceId", "==", resourceId],
        ["rating", "between", [1, 5]],
      ],
      orderBy: [["rating", "asc"]],
      groupBy: ["rating"],
    });
    const distribution: RatingDistribution = {};
    for (const rating of RATING_VALUES) distribution[rating] = 0n;
    for (const [key, count] of counts) {
      const rating = ratingFromKeyHex(key);
      if (rating === null) {
        log(`Unexpected rating key "${key}" for ${resourceId}`, "error");
        continue;
      }
      distribution[rating] += count;
    }
    return distribution;
  } catch (err) {
    log(
      `Distribution query failed for ${resourceId}: ${errorMessage(err)}`,
      "error",
    );
    throw err;
  }
}

/** One page of reviews plus the cursor for the next (null on the last). */
export interface ReviewPage {
  reviews: ReviewRecord[];
  nextCursor: string | null;
}

/**
 * A page of a resource's reviews, newest first, optionally only one star
 * value. Paging is server-side: pass the previous page's `nextCursor` as
 * `startAfter` (an exclusive document ID). It asks for `limit + 1` and shows
 * `limit`: the extra row only says whether another page exists, so an exact
 * multiple of the page size doesn't end on an empty "Load more".
 *
 * `orderBy` must be the serving index's TRAILING property, so `$updatedAt`
 * works for both shapes:
 *  - no filter → `resourceId ==`              → resourceRecent [resourceId, $updatedAt]
 *  - filter    → `resourceId ==, rating ==`   → resourceRatingRecent [resourceId, rating, $updatedAt]
 * The map the SDK returns is already in index-walk (server) order — don't
 * re-sort it.
 */
export async function listResourceReviews({
  sdk,
  contractId,
  resourceId,
  ratingFilter,
  startAfter,
  limit = REVIEW_PAGE_SIZE,
  log = consoleLogger,
}: {
  sdk: DashSdk;
  contractId: string;
  resourceId: string;
  ratingFilter?: number;
  startAfter?: string;
  limit?: number;
  log?: Logger;
}): Promise<ReviewPage> {
  const where: unknown[][] = [["resourceId", "==", resourceId]];
  if (ratingFilter != null) where.push(["rating", "==", ratingFilter]);
  const results = await sdk.documents.query({
    dataContractId: contractId,
    documentTypeName: "review",
    where,
    orderBy: [["$updatedAt", "desc"]],
    limit: limit + 1,
    ...(startAfter ? { startAfter } : {}),
  });
  const fetched = normalizeReviews(results);
  const reviews = fetched.slice(0, limit);
  // The cursor is the last review SHOWN, so the extra one leads page 2.
  const nextCursor =
    fetched.length > limit ? (reviews[reviews.length - 1]?.id ?? null) : null;
  log(`Loaded ${reviews.length} reviews for ${resourceId}.`);
  return { reviews, nextCursor };
}

export async function listMyReviews({
  sdk,
  contractId,
  ownerId,
  limit = MY_REVIEWS_LIMIT,
  log = consoleLogger,
}: {
  sdk: DashSdk;
  contractId: string;
  ownerId: string;
  limit?: number;
  log?: Logger;
}): Promise<ReviewRecord[]> {
  const results = await sdk.documents.query({
    dataContractId: contractId,
    documentTypeName: "review",
    // Newest first, server-side, via ownerReviews [$ownerId, $updatedAt].
    where: [["$ownerId", "==", ownerId]],
    orderBy: [["$updatedAt", "desc"]],
    limit,
  });
  const reviews = normalizeReviews(results);
  log(`Loaded ${reviews.length} reviews for identity ${ownerId}.`);
  return reviews;
}

export async function findMyReviewForResource({
  sdk,
  contractId,
  resourceId,
  ownerId,
}: {
  sdk: DashSdk;
  contractId: string;
  resourceId: string;
  ownerId: string;
}): Promise<ReviewRecord | null> {
  const results = await sdk.documents.query({
    dataContractId: contractId,
    documentTypeName: "review",
    where: [
      ["$ownerId", "==", ownerId],
      ["resourceId", "==", resourceId],
    ],
    orderBy: [
      ["$ownerId", "asc"],
      ["resourceId", "asc"],
    ],
    limit: 1,
  });
  return normalizeReviews(results)[0] ?? null;
}
