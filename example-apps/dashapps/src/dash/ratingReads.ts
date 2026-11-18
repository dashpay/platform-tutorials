import { requireId } from "./ids";
import type { ReadSdk, WhereClause } from "./types";
import { toDocumentArray, type DocumentHandle } from "../lib/safeDoc";

// The current registry's rating type; contract.ts declares `appReview` instead.
export const RATING_DOCUMENT_TYPE = "appRating";
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
export interface RatingSummary {
  count: bigint;
  average: number | null;
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

/** count = Σ dist[s]; average = Σ (s × dist[s]) / count. No sum query needed. */
export function summarize(distribution: RatingDistribution): RatingSummary {
  let count = 0n;
  let sum = 0n;
  for (const stars of STAR_VALUES) {
    const value = distribution[stars] ?? 0n;
    count += value;
    sum += BigInt(stars) * value;
  }
  return {
    count,
    average: count > 0n ? Number(sum) / Number(count) : null,
    distribution,
  };
}

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

function documentId(document: DocumentHandle) {
  const object =
    (
      document as DocumentHandle & {
        toObject?: () => Record<string, unknown>;
      }
    ).toObject?.() ?? {};
  return requireId(document.id ?? object.$id);
}

function parseRatings(documents: DocumentHandle[]) {
  return documents.flatMap((document) => {
    try {
      return [ratingRecord(document)];
    } catch {
      return [];
    }
  });
}

/**
 * Per-star counts from one grouped count over `byContractStars`. The `between`
 * range on `stars` puts the query in range-distinct mode (one entry per present
 * value); absent stars are reported as 0. Total and average derive from this.
 */
export async function ratingSummary(
  sdk: ReadSdk,
  registryId: string,
  contractId: string,
): Promise<RatingSummary> {
  const counts = await sdk.documents.count({
    dataContractId: requireId(registryId),
    documentTypeName: RATING_DOCUMENT_TYPE,
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
  return summarize(distribution);
}

export interface RatingPage {
  ratings: RatingRecord[];
  cursor?: string;
}

/**
 * One server-ordered page of a contract's ratings; don't re-sort it. Ties
 * within one star value come back in document-ID order, not by time. The
 * extra `limit + 1` row only says whether another page exists.
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
  const limit = options.limit ?? RATING_PAGE_SIZE;
  const where: WhereClause[] = [["contractId", "==", requireId(contractId)]];
  let orderBy: [string, "asc" | "desc"][];
  if (options.stars !== undefined) {
    if (!isStars(options.stars)) throw new Error("Choose 1 to 5 stars.");
    where.push(["stars", "==", options.stars]);
    orderBy = [["stars", "asc"]];
  } else if (sort === "recent") orderBy = [["$createdAt", "desc"]];
  else orderBy = [["stars", sort === "highest" ? "desc" : "asc"]];
  const startAfter = options.cursor ? requireId(options.cursor) : undefined;
  const documents = toDocumentArray(
    await sdk.documents.query({
      dataContractId: requireId(registryId),
      documentTypeName: RATING_DOCUMENT_TYPE,
      where,
      orderBy,
      limit: limit + 1,
      ...(startAfter ? { startAfter } : {}),
    }),
  );
  const shown = documents.slice(0, limit);
  const cursor =
    documents.length > limit ? documentId(shown[shown.length - 1]) : undefined;
  if (cursor && cursor === startAfter)
    throw new Error("Rating pagination cursor did not advance.");
  return { ratings: parseRatings(shown), cursor };
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
      documentTypeName: RATING_DOCUMENT_TYPE,
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
