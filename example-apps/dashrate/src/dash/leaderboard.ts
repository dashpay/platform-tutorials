/**
 * Cross-resource rankings over the `resourceRating` index's ranked axes.
 *
 * SDK methods:
 *   sdk.documents.ranked(...)       // top N groups by avg / count
 *   sdk.documents.having(...)       // every group whose avg passes a bound
 *
 * Both group by `resourceId` (the ranked index's single, trailing property,
 * so no `where` pins are allowed) and return proven entries whose
 * `groupValue` is already the decoded resourceId.
 */
import type { DashGroupedResult, DashSdk } from "./types";

/**
 * The ranked-query ceiling: `limit` must be 1..100, and a larger value is
 * rejected, not clamped. (Also exposed as the static
 * `EvoSDK.maxRankedLimit()`.)
 */
export const MAX_RANKED_LIMIT = 100;

export type LeaderboardMetric = "avg" | "count";

export interface LeaderboardEntry {
  resourceId: string;
  /** Average rating (avg) or review count (count), ready for display. */
  value: number;
}

/**
 * Entries in server order, keeping only catalog resource IDs (anyone can
 * rate an ID outside the catalog). `groupValue` arrives already decoded.
 * `valueAsNumber` is display-ready; see CLAUDE.md for the 100-group cap
 * and avg truncation.
 */
function toEntries(
  result: DashGroupedResult,
  allowed: ReadonlySet<string>,
): LeaderboardEntry[] {
  return result.entries
    .map((entry) => ({
      resourceId: typeof entry.groupValue === "string" ? entry.groupValue : "",
      value: entry.valueAsNumber,
    }))
    .filter((entry) => allowed.has(entry.resourceId));
}

/**
 * The resources ranked by average rating ("Top rated") or review count
 * ("Most reviewed"), best first. Resources with no reviews are absent.
 */
export async function getLeaderboard({
  sdk,
  contractId,
  metric,
  resourceIds,
}: {
  sdk: DashSdk;
  contractId: string;
  metric: LeaderboardMetric;
  resourceIds: readonly string[];
}): Promise<LeaderboardEntry[]> {
  const result = await sdk.documents.ranked({
    dataContractId: contractId,
    documentTypeName: "review",
    groupBy: "resourceId",
    aggregate:
      metric === "avg"
        ? { type: "avg", property: "rating" }
        : { type: "count" },
    direction: "desc",
    limit: MAX_RANKED_LIMIT,
  });
  return toEntries(result, new Set(resourceIds));
}

/**
 * The resources whose average rating is at least `minAverage` — a HAVING
 * filter on the avg axis. The bound is unscaled and inclusive (4.0 passes),
 * and the proof means a node can't silently omit a qualifying resource.
 */
export async function getResourcesWithMinAverage({
  sdk,
  contractId,
  minAverage,
  resourceIds,
}: {
  sdk: DashSdk;
  contractId: string;
  minAverage: number;
  resourceIds: readonly string[];
}): Promise<LeaderboardEntry[]> {
  const result = await sdk.documents.having({
    dataContractId: contractId,
    documentTypeName: "review",
    groupBy: "resourceId",
    aggregate: { type: "avg", property: "rating" },
    having: { operator: ">=", value: minAverage },
    direction: "desc",
    limit: MAX_RANKED_LIMIT,
  });
  return toEntries(result, new Set(resourceIds));
}
