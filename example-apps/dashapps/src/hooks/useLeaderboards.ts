import { useEffect, useState } from "react";
import {
  highlyRated,
  leaderboard,
  rankedNames,
  type LeaderboardEntry,
  type RankedName,
} from "../dash/leaderboard";
import { ratingAverages, type RatingAverage } from "../dash/ratingReads";
import type { ReadSdk } from "../dash/types";
import { errorMessage } from "../lib/logger";

export interface Leaderboards {
  topRated: LeaderboardEntry[];
  mostRated: LeaderboardEntry[];
  /** Contract IDs averaging 4★ or more. */
  highlyRated: Set<string>;
  names: Map<string, RankedName>;
  /** Average and review count for every ranked contract. */
  averages: Map<string, RatingAverage>;
}

/**
 * "Top rated" and "Most rated" (two `ranked` calls), the 4★+ set (`having`),
 * and display names and review counts for the ranked rows. Reloads per
 * registry and on each `refreshToken` bump; a failure stays local.
 */
export function useLeaderboards(
  sdk: ReadSdk | undefined,
  registryId: string,
  refreshToken = 0,
) {
  const scope = sdk && registryId ? `${registryId}:${refreshToken}` : "";
  const [state, setState] = useState<{
    scope: string;
    leaderboards: Leaderboards | null;
    error: string;
  }>({ scope: "", leaderboards: null, error: "" });

  useEffect(() => {
    if (!sdk || !registryId) return;
    let active = true;
    void (async () => {
      try {
        const [topRated, mostRated, highly] = await Promise.all([
          leaderboard(sdk, registryId, "avg"),
          leaderboard(sdk, registryId, "count"),
          highlyRated(sdk, registryId),
        ]);
        const ranked = [
          ...topRated.map((entry) => entry.contractId),
          ...mostRated.map((entry) => entry.contractId),
        ];
        const [names, averages] = await Promise.all([
          rankedNames(sdk, registryId, ranked),
          ratingAverages(sdk, registryId, ranked),
        ]);
        if (active)
          setState({
            scope,
            leaderboards: {
              topRated,
              mostRated,
              highlyRated: new Set(highly.map((entry) => entry.contractId)),
              names,
              averages,
            },
            error: "",
          });
      } catch (caught) {
        if (active)
          setState({ scope, leaderboards: null, error: errorMessage(caught) });
      }
    })();
    return () => {
      active = false;
    };
  }, [sdk, registryId, scope]);

  const current = state.scope === scope ? state : undefined;
  return {
    leaderboards: current?.leaderboards ?? null,
    loading: Boolean(scope) && !current,
    error: current?.error ?? "",
  };
}
