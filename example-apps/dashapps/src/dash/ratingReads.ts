import { idFromKeyHex, requireId } from "./ids";
import type { ReadSdk, WhereClause } from "./types";
import { toDocumentArray, type DocumentHandle } from "../lib/safeDoc";
import { chunks, parseEach, queryPage } from "./paging";

export const REVIEW_DOCUMENT_TYPE = "appReview";
export const STAR_VALUES = [1, 2, 3, 4, 5] as const;
export type Stars = (typeof STAR_VALUES)[number];
/** Ratings per server page; "Load more" fetches the next one. */
export const RATING_PAGE_SIZE = 25;
export type RatingSort = "recent" | "highest" | "lowest";

export interface RatingRecord {
  id: string;
  ownerId: string;
  contractId: string;
  stars: Stars;
  title?: string;
  body?: string;
  createdAt?: bigint;
  updatedAt?: bigint;
  revision: bigint;
}
export type RatingDistribution = Record<Stars, bigint>;
export interface RatingAverage {
  count: bigint;
  sum: bigint;
  average: number | null;
}
export interface RatingSummary extends RatingAverage {
  distribution: RatingDistribution;
}

export function isStars(value: unknown): value is Stars {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  );
}

/**
 * Decode a grouped `count` result-map key back to its star value, or null if
 * the key isn't a valid star value.
 *
 * Keys are the hex of the raw index-key bytes, not the value: 5 stars → "05".
 */
export function starsFromKeyHex(key: string): Stars | null {
  if (!/^[0-9a-f]{2}$/i.test(key)) return null;
  const stars = parseInt(key, 16);
  return isStars(stars) ? stars : null;
}

export function emptyDistribution(): RatingDistribution {
  return { 1: 0n, 2: 0n, 3: 0n, 4: 0n, 5: 0n };
}

function toAverage(value: unknown): RatingAverage {
  const { count, sum } = (value ?? {}) as { count?: unknown; sum?: unknown };
  if (
    typeof count !== "bigint" ||
    typeof sum !== "bigint" ||
    count < 0n ||
    sum < 0n
  )
    throw new Error("Malformed average response.");
  return {
    count,
    sum,
    average: count > 0n ? Number(sum) / Number(count) : null,
  };
}

const NO_RATINGS: RatingAverage = { count: 0n, sum: 0n, average: null };

function optionalString(value: unknown, field: string): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string") throw new Error(`Malformed rating ${field}.`);
  return value;
}

function bigintField(value: unknown): bigint | undefined {
  if (value == null) return undefined;
  try {
    return BigInt(value as string | number | bigint);
  } catch {
    throw new Error("Malformed rating timestamp or revision.");
  }
}

function starsField(value: unknown): Stars {
  const numeric =
    typeof value === "bigint"
      ? Number(value)
      : typeof value === "string" && value
        ? Number(value)
        : value;
  if (!isStars(numeric)) throw new Error("Malformed rating stars.");
  return numeric;
}

export function ratingRecord(document: DocumentHandle): RatingRecord {
  const source = document as DocumentHandle & {
    createdAt?: unknown;
    updatedAt?: unknown;
    revision?: unknown;
    toObject?: () => Record<string, unknown>;
  };
  const object = source.toObject?.() ?? {};
  const properties = source.properties ?? object;
  return {
    id: requireId(source.id ?? object.$id),
    ownerId: requireId(source.ownerId ?? object.$ownerId),
    contractId: requireId(properties.contractId),
    stars: starsField(properties.stars),
    title: optionalString(properties.title, "title"),
    body: optionalString(properties.body, "body"),
    createdAt: bigintField(source.createdAt ?? object.$createdAt),
    updatedAt: bigintField(source.updatedAt ?? object.$updatedAt),
    revision: bigintField(source.revision ?? object.$revision) ?? 1n,
  };
}

function parseRatings(documents: DocumentHandle[]) {
  return parseEach(documents, ratingRecord);
}

/**
 * Proven count and sum of one contract's ratings, from `contractRating`'s
 * averageable `stars`. A contract with no ratings returns an empty map.
 */
export async function ratingAverage(
  sdk: ReadSdk,
  registryId: string,
  contractId: string,
): Promise<RatingAverage> {
  const result = await sdk.documents.average(
    {
      dataContractId: requireId(registryId),
      documentTypeName: REVIEW_DOCUMENT_TYPE,
      where: [["contractId", "==", requireId(contractId)]],
    },
    "stars",
  );
  if (!(result instanceof Map) || result.size > 1)
    throw new Error("Malformed average response.");
  return result.size ? toAverage(result.get("")) : NO_RATINGS;
}

/**
 * Averages for a page of contracts, one grouped `average` per 100. Groups
 * come back keyed by the identifier's raw bytes in hex, and contracts with no
 * ratings are absent, so every requested ID is filled in.
 */
export async function ratingAverages(
  sdk: ReadSdk,
  registryId: string,
  contractIds: string[],
): Promise<Map<string, RatingAverage>> {
  const ids = [...new Set(contractIds.map((value) => requireId(value)))];
  const averages = new Map(ids.map((id) => [id, NO_RATINGS]));
  for (const chunk of chunks(ids)) {
    const result = await sdk.documents.average(
      {
        dataContractId: requireId(registryId),
        documentTypeName: REVIEW_DOCUMENT_TYPE,
        where: [["contractId", "in", chunk]],
        groupBy: ["contractId"],
      },
      "stars",
    );
    if (!(result instanceof Map))
      throw new Error("Malformed average response.");
    for (const [key, value] of result) {
      const contractId = idFromKeyHex(key);
      if (!chunk.includes(contractId))
        throw new Error("Malformed average response.");
      averages.set(contractId, toAverage(value));
    }
  }
  return averages;
}

/**
 * Per-star counts from one grouped count over `contractStars`. Grouping needs
 * the `between` range on `stars`, which returns one entry per present value;
 * absent stars are reported as 0. Never batch this across contracts.
 */
export async function ratingDistribution(
  sdk: ReadSdk,
  registryId: string,
  contractId: string,
): Promise<RatingDistribution> {
  const counts = await sdk.documents.count({
    dataContractId: requireId(registryId),
    documentTypeName: REVIEW_DOCUMENT_TYPE,
    where: [
      ["contractId", "==", requireId(contractId)],
      ["stars", "between", [1, 5]],
    ],
    orderBy: [["stars", "asc"]],
    groupBy: ["stars"],
  });
  if (!(counts instanceof Map)) throw new Error("Malformed count response.");
  const distribution = emptyDistribution();
  for (const [key, value] of counts) {
    const stars = typeof key === "string" ? starsFromKeyHex(key) : null;
    if (stars === null || typeof value !== "bigint" || value < 0n)
      throw new Error("Malformed count response.");
    distribution[stars] += value;
  }
  return distribution;
}

export async function ratingSummary(
  sdk: ReadSdk,
  registryId: string,
  contractId: string,
): Promise<RatingSummary> {
  const [average, distribution] = await Promise.all([
    ratingAverage(sdk, registryId, contractId),
    ratingDistribution(sdk, registryId, contractId),
  ]);
  return { ...average, distribution };
}

export interface RatingPage {
  ratings: RatingRecord[];
  cursor?: string;
}

/**
 * One server-ordered page of a contract's ratings, newest first within each
 * star value; don't re-sort it.
 */
export async function listRatings(
  sdk: ReadSdk,
  registryId: string,
  contractId: string,
  options: {
    sort?: RatingSort;
    stars?: Stars;
    cursor?: string;
    limit?: number;
  } = {},
): Promise<RatingPage> {
  const sort = options.sort ?? "recent";
  const where: WhereClause[] = [["contractId", "==", requireId(contractId)]];
  let orderBy: [string, "asc" | "desc"][] = [["$updatedAt", "desc"]];
  if (options.stars !== undefined) {
    if (!isStars(options.stars)) throw new Error("Choose 1 to 5 stars.");
    where.push(["stars", "==", options.stars]);
  } else if (sort !== "recent")
    orderBy = [
      ["stars", sort === "highest" ? "desc" : "asc"],
      ["$updatedAt", "desc"],
    ];
  const page = await queryPage(
    sdk,
    {
      dataContractId: requireId(registryId),
      documentTypeName: REVIEW_DOCUMENT_TYPE,
      where,
      orderBy,
    },
    ratingRecord,
    options.limit ?? RATING_PAGE_SIZE,
    options.cursor,
  );
  return { ratings: page.items, cursor: page.cursor };
}

/** An identity's ratings across every contract, most recently updated first. */
export async function myRatings(
  sdk: ReadSdk,
  registryId: string,
  ownerId: string,
  cursor?: string,
  limit = RATING_PAGE_SIZE,
): Promise<RatingPage> {
  const page = await queryPage(
    sdk,
    {
      dataContractId: requireId(registryId),
      documentTypeName: REVIEW_DOCUMENT_TYPE,
      where: [["$ownerId", "==", requireId(ownerId)]],
      orderBy: [["$updatedAt", "desc"]],
    },
    ratingRecord,
    limit,
    cursor,
  );
  return { ratings: page.items, cursor: page.cursor };
}

export async function ownRating(
  sdk: ReadSdk,
  registryId: string,
  ownerId: string,
  contractId: string,
): Promise<RatingRecord | null> {
  const documents = toDocumentArray(
    await sdk.documents.query({
      dataContractId: requireId(registryId),
      documentTypeName: REVIEW_DOCUMENT_TYPE,
      where: [
        ["$ownerId", "==", requireId(ownerId)],
        ["contractId", "==", requireId(contractId)],
      ],
      orderBy: [
        ["$ownerId", "asc"],
        ["contractId", "asc"],
      ],
      limit: 1,
    }),
  );
  return parseRatings(documents)[0] ?? null;
}
