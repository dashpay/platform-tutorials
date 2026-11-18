/**
 * Cross-contract rankings over `contractRating`'s ranked axes. Both group by
 * `contractId`, the index's single property, so no `where` pins are allowed,
 * and return proven entries whose `groupValue` is already base58.
 */
import { requireId } from "./ids";
import type { GroupedResult, ReadSdk } from "./types";
import { REVIEW_DOCUMENT_TYPE } from "./ratingReads";
import { contractEntries, type RegistryEntry } from "./registryReads";
import { endorsementsFor, officialListingOf } from "./endorsementReads";

/** `limit` must be 1..100; a larger value is rejected, not clamped. */
export const MAX_RANKED_LIMIT = 100;
export const LEADERBOARD_SIZE = 10;
export const HIGHLY_RATED_MIN_AVERAGE = 4;

export type LeaderboardMetric = "avg" | "count";

export interface LeaderboardEntry {
  contractId: string;
  /** Average rating (avg) or rating count (count), ready for display. */
  value: number;
  /** 0-based absolute rank; `ranked` only. */
  rank?: number;
}

/** Entries in server order. Ties within one value come back in no meaningful order. */
function toEntries(result: GroupedResult): LeaderboardEntry[] {
  return result.entries.map((entry) => ({
    contractId: requireId(entry.groupValue),
    value: entry.valueAsNumber,
    ...(entry.rank !== undefined ? { rank: Number(entry.rank) } : {}),
  }));
}

/**
 * Contracts ranked by average rating ("Top rated") or rating count ("Most
 * rated"), best first; `offset` skips ranks. Unrated contracts are absent.
 */
export async function leaderboard(
  sdk: ReadSdk,
  registryId: string,
  metric: LeaderboardMetric,
  {
    limit = LEADERBOARD_SIZE,
    offset,
  }: { limit?: number; offset?: number } = {},
): Promise<LeaderboardEntry[]> {
  const result = await sdk.documents.ranked({
    dataContractId: requireId(registryId),
    documentTypeName: REVIEW_DOCUMENT_TYPE,
    groupBy: "contractId",
    aggregate:
      metric === "avg" ? { type: "avg", property: "stars" } : { type: "count" },
    direction: "desc",
    limit,
    ...(offset ? { offset } : {}),
  });
  return toEntries(result);
}

/** Up to 100 contracts whose average is at least `minAverage` (inclusive). */
export async function highlyRated(
  sdk: ReadSdk,
  registryId: string,
  minAverage = HIGHLY_RATED_MIN_AVERAGE,
): Promise<LeaderboardEntry[]> {
  const result = await sdk.documents.having({
    dataContractId: requireId(registryId),
    documentTypeName: REVIEW_DOCUMENT_TYPE,
    groupBy: "contractId",
    aggregate: { type: "avg", property: "stars" },
    having: { operator: ">=", value: minAverage },
    direction: "desc",
    limit: MAX_RANKED_LIMIT,
  });
  return toEntries(result);
}

export interface RankedName {
  name: string;
  /** False when the name comes from the newest community entry. */
  official: boolean;
  entry: RegistryEntry;
}

/**
 * Display names for ranked contracts: the official entry when the contract
 * is endorsed, otherwise its newest entry (anyone can write that one).
 * Contracts with neither are absent.
 */
export async function rankedNames(
  sdk: ReadSdk,
  registryId: string,
  contractIds: string[],
): Promise<Map<string, RankedName>> {
  const endorsements = await endorsementsFor(sdk, registryId, contractIds);
  const rows = await Promise.all(
    [...new Set(contractIds)].map(async (contractId) => {
      const endorsement = endorsements.get(contractId);
      const official = endorsement
        ? (await officialListingOf(sdk, registryId, endorsement)).entry
        : null;
      const entry =
        official ??
        (await contractEntries(sdk, registryId, contractId, undefined, 1))
          .entries[0];
      return entry
        ? ([
            contractId,
            { name: entry.name, official: Boolean(official), entry },
          ] as const)
        : null;
    }),
  );
  return new Map(rows.filter((row) => row !== null));
}
