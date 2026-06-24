/**
 * Read-side queries and aggregate helpers for DashRate reviews.
 *
 * SDK methods:
 *   sdk.documents.query(...)
 *   sdk.documents.count(...)        // plain and grouped (GROUP BY rating)
 *
 * The count/sum/average shown per resource is derived in JS from the grouped
 * count distribution — there is no `sum`/`average` query (see
 * summaryFromDistribution).
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

const REVIEW_LIMIT = 50;

/** The valid rating values, used to build distribution lookup keys. */
const RATING_VALUES = [1, 2, 3, 4, 5] as const;

export function firstMapValue<T>(map: Map<string, T>): T | undefined {
  return map.values().next().value as T | undefined;
}

/**
 * Index-key for an integer rating in a grouped `count` result map.
 *
 * Platform encodes an integer index key in its order-preserving form: the
 * sign bit is flipped so negatives sort before positives. For a small
 * positive rating that's a single byte `0x80 | rating`, hex-encoded — e.g.
 * rating 5 → `0x85` → "85". (Verified against the live contract: a grouped
 * count over ratings returns keys "81".."85", NOT 8-byte big-endian.) The
 * client builds the expected keys by encoding each known rating rather than
 * decoding the returned keys.
 */
export function ratingKeyHex(rating: number): string {
  return (0x80 | rating).toString(16);
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

/**
 * Build a RatingSummary from a rating distribution. The per-star counts
 * carry everything the summary needs, exactly for the 1–5 integer scale:
 *   count   = Σ dist[r]
 *   sum     = Σ (r × dist[r])
 *   average = sum / count
 * So no separate `sum`/`average` query is needed — the grouped count that
 * draws the histogram also yields the average. (Dropping `summable` from
 * the contract is what avoids the index-aggregation conflict.)
 */
export function summaryFromDistribution(
  resourceId: string,
  distribution: RatingDistribution,
): RatingSummary {
  let count = 0n;
  let sum = 0n;
  for (const rating of RATING_VALUES) {
    const c = distribution[rating] ?? 0n;
    count += c;
    sum += BigInt(rating) * c;
  }
  const average = count > 0n ? Number(sum) / Number(count) : null;
  return { resourceId, count, sum, average };
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
 * Total review count for a resource — a plain ungrouped `count()` over the
 * single-property `resourceRatingAggregate` index. This is the basic
 * countable-index pattern (contrast with getRatingDistribution's grouped
 * count). The ungrouped result is a one-entry map keyed by "" — read it
 * with firstMapValue.
 */
export async function getRatingCount({
  sdk,
  contractId,
  resourceId,
  log = consoleLogger,
}: {
  sdk: DashSdk;
  contractId: string;
  resourceId: string;
  log?: Logger;
}): Promise<bigint> {
  const query = resourceAggregateQuery(contractId, resourceId);
  log(`Counting reviews for ${resourceId}...`);
  try {
    const counts = await sdk.documents.count(query);
    const total = firstMapValue(counts) ?? 0n;
    log(`Count for ${resourceId}: ${total}`);
    return total;
  } catch (err) {
    log(`Count query failed for ${resourceId}: ${errorMessage(err)}`, "error");
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
  log(`Loading rating distribution for ${resourceId}...`);
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
    for (const rating of RATING_VALUES) {
      distribution[rating] = counts.get(ratingKeyHex(rating)) ?? 0n;
    }
    log(`Distribution for ${resourceId}: ${distributionLabel(distribution)}`);
    return distribution;
  } catch (err) {
    log(
      `Distribution query failed for ${resourceId}: ${errorMessage(err)}`,
      "error",
    );
    throw err;
  }
}

function distributionLabel(distribution: RatingDistribution): string {
  return RATING_VALUES.map(
    (rating) => `${rating}★=${distribution[rating] ?? 0n}`,
  ).join(" ");
}

export async function listResourceReviews({
  sdk,
  contractId,
  resourceId,
  ratingFilter,
  limit = REVIEW_LIMIT,
  log = consoleLogger,
}: {
  sdk: DashSdk;
  contractId: string;
  resourceId: string;
  ratingFilter?: number;
  limit?: number;
  log?: Logger;
}): Promise<ReviewRecord[]> {
  // Filtering by rating is done server-side via a `rating == N` clause —
  // the data is already fetched, so this is to demonstrate Platform
  // `where`-filtering and to stay correct past the fetch limit.
  //
  // The `orderBy` must align with the index that serves the query, and
  // its field must be the index's trailing property (the matcher reserves
  // the order-by field from the back of the index). So:
  //  - no filter → resourceId equality on [resourceId] → order by resourceId
  //  - filter    → resourceId+rating equalities on [resourceId, rating] →
  //                order by rating (the last index property)
  // Ordering by resourceId in the filtered case strips `rating` out of the
  // usable index prefix and the query is rejected as "non indexed".
  const where: unknown[][] = [["resourceId", "==", resourceId]];
  let orderBy: [string, "asc" | "desc"][] = [["resourceId", "asc"]];
  if (ratingFilter != null) {
    where.push(["rating", "==", ratingFilter]);
    orderBy = [["rating", "asc"]];
    log(`Loading ${ratingFilter}-star reviews for ${resourceId}...`);
  } else {
    log(`Loading reviews for ${resourceId}...`);
  }
  const results = await sdk.documents.query({
    dataContractId: contractId,
    documentTypeName: "review",
    where,
    orderBy,
    limit,
  });
  const reviews = normalizeReviews(results).sort(
    (left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0),
  );
  log(`Loaded ${reviews.length} reviews for ${resourceId}.`);
  return reviews;
}

export async function listMyReviews({
  sdk,
  contractId,
  ownerId,
  limit = REVIEW_LIMIT,
  log = consoleLogger,
}: {
  sdk: DashSdk;
  contractId: string;
  ownerId: string;
  limit?: number;
  log?: Logger;
}): Promise<ReviewRecord[]> {
  log(`Loading reviews for identity ${ownerId}...`);
  const results = await sdk.documents.query({
    dataContractId: contractId,
    documentTypeName: "review",
    where: [["$ownerId", "==", ownerId]],
    orderBy: [
      ["$ownerId", "asc"],
      ["$updatedAt", "asc"],
    ],
    limit,
  });
  const reviews = normalizeReviews(results).sort(
    (left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0),
  );
  log(`Loaded ${reviews.length} reviews for identity ${ownerId}.`);
  return reviews;
}

export async function findMyReviewForResource({
  sdk,
  contractId,
  resourceId,
  ownerId,
  log = consoleLogger,
}: {
  sdk: DashSdk;
  contractId: string;
  resourceId: string;
  ownerId: string;
  log?: Logger;
}): Promise<ReviewRecord | null> {
  log(`Checking existing review for ${resourceId} by ${ownerId}...`);
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
  const review = normalizeReviews(results)[0] ?? null;
  log(
    review
      ? `Found existing review ${review.id}.`
      : "No existing review found.",
  );
  return review;
}
