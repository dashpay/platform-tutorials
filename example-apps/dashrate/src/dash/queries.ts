/**
 * Read-side queries and aggregate helpers for DashRate reviews.
 *
 * SDK methods:
 *   sdk.documents.query(...)
 *   sdk.documents.count(...)
 *   sdk.documents.sum(...)
 *   sdk.documents.average(...)
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

const REVIEW_LIMIT = 50;

export function firstMapValue<T>(map: Map<string, T>): T | undefined {
  return map.values().next().value as T | undefined;
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

export function summaryFromAggregateMaps({
  resourceId,
  countMap,
  sumMap,
  averageMap,
}: {
  resourceId: string;
  countMap: Map<string, bigint>;
  sumMap: Map<string, bigint>;
  averageMap: Map<string, { count: bigint; sum: bigint }>;
}): RatingSummary {
  const count = firstMapValue(countMap) ?? 0n;
  const sum = firstMapValue(sumMap) ?? 0n;
  const averageParts = firstMapValue(averageMap);
  const average =
    averageParts && averageParts.count > 0n
      ? Number(averageParts.sum) / Number(averageParts.count)
      : count > 0n
        ? Number(sum) / Number(count)
        : null;
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
  const query = resourceAggregateQuery(contractId, resourceId);
  log(`Aggregating ratings for ${resourceId}...`);
  try {
    const [countMap, sumMap, averageMap] = await Promise.all([
      sdk.documents.count(query),
      sdk.documents.sum(query, "rating"),
      sdk.documents.average(query, "rating"),
    ]);
    log(
      `Aggregate maps for ${resourceId}: count=${countMap.size}, sum=${sumMap.size}, average=${averageMap.size}`,
    );
    return summaryFromAggregateMaps({
      resourceId,
      countMap,
      sumMap,
      averageMap,
    });
  } catch (err) {
    log(
      `Aggregate query failed for ${resourceId}: ${errorMessage(err)}`,
      "error",
    );
    throw err;
  }
}

export async function listResourceReviews({
  sdk,
  contractId,
  resourceId,
  limit = REVIEW_LIMIT,
  log = consoleLogger,
}: {
  sdk: DashSdk;
  contractId: string;
  resourceId: string;
  limit?: number;
  log?: Logger;
}): Promise<ReviewRecord[]> {
  log(`Loading reviews for ${resourceId}...`);
  const results = await sdk.documents.query({
    dataContractId: contractId,
    documentTypeName: "review",
    where: [["resourceId", "==", resourceId]],
    orderBy: [["resourceId", "asc"]],
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
