import { requireId } from "./ids";
import type { ReadSdk, WhereClause } from "./types";
import { toDocumentArray, type DocumentHandle } from "../lib/safeDoc";

export const RATING_DOCUMENT_TYPE = "appRating";
export const STAR_VALUES = [1, 2, 3, 4, 5] as const;
export type Stars = (typeof STAR_VALUES)[number];
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
 * Index key of an integer in a grouped `count` result. Platform encodes an
 * integer index key in order-preserving form (sign bit flipped), so a small
 * positive value is the single byte `0x80 | value`, hex-encoded: 5 → "85".
 * The SDK exposes no decoder, so the client encodes the values it looks for.
 */
export function starsKeyHex(stars: Stars): string {
  return (0x80 | stars).toString(16);
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

async function query(
  sdk: ReadSdk,
  args: Parameters<ReadSdk["documents"]["query"]>[0],
) {
  const documents = toDocumentArray(await sdk.documents.query(args));
  const ratings = documents.flatMap((document) => {
    try {
      return [ratingRecord(document)];
    } catch {
      return [];
    }
  });
  const last = documents.at(-1);
  const lastObject =
    (
      last as DocumentHandle & {
        toObject?: () => Record<string, unknown>;
      }
    )?.toObject?.() ?? {};
  return {
    ratings,
    rowCount: documents.length,
    lastId: last ? requireId(last.id ?? lastObject.$id) : undefined,
  };
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
  for (const stars of STAR_VALUES) {
    const value = counts.get(starsKeyHex(stars));
    if (value == null) continue;
    if (typeof value !== "bigint" || value < 0n)
      throw new Error("Malformed count response.");
    distribution[stars] = value;
  }
  return summarize(distribution);
}

/**
 * One page of ratings for a contract. The `orderBy` field must be the serving
 * index's trailing property: `$createdAt` on `byContractCreated` for recency,
 * `stars` on `byContractStars` for highest/lowest and for the `stars == N`
 * filter (a point lookup, which then orders within the star value).
 */
export async function listRatings(
  sdk: ReadSdk,
  registryId: string,
  contractId: string,
  options: { sort?: RatingSort; stars?: Stars; cursor?: string } = {},
) {
  const sort = options.sort ?? "recent";
  const where: WhereClause[] = [["contractId", "==", requireId(contractId)]];
  let orderBy: [string, "asc" | "desc"][];
  if (options.stars !== undefined) {
    if (!isStars(options.stars)) throw new Error("Choose 1 to 5 stars.");
    where.push(["stars", "==", options.stars]);
    orderBy = [["stars", "asc"]];
  } else if (sort === "recent") orderBy = [["$createdAt", "desc"]];
  else orderBy = [["stars", sort === "highest" ? "desc" : "asc"]];
  const page = await query(sdk, {
    dataContractId: requireId(registryId),
    documentTypeName: RATING_DOCUMENT_TYPE,
    where,
    orderBy,
    limit: RATING_PAGE_SIZE,
    ...(options.cursor ? { startAfter: requireId(options.cursor) } : {}),
  });
  const next = page.rowCount === RATING_PAGE_SIZE ? page.lastId : undefined;
  if (next && next === options.cursor)
    throw new Error("Rating pagination cursor did not advance.");
  return { ratings: page.ratings, cursor: next };
}

export async function ownRating(
  sdk: ReadSdk,
  registryId: string,
  ownerId: string,
  contractId: string,
): Promise<RatingRecord | null> {
  const { ratings } = await query(sdk, {
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
  });
  return ratings[0] ?? null;
}
