import { useEffect, useRef, useState } from "react";
import { RESOURCES } from "../catalog/resources";
import {
  getLeaderboard,
  getResourcesWithMinAverage,
} from "../dash/leaderboard";
import type { DashSdk } from "../dash/types";
import { errorMessage, type LogLevel } from "../lib/logger";
import { HIGHLY_RATED_MIN_AVERAGE, type Leaderboards } from "../lib/ratings";

const CATALOG_IDS = RESOURCES.map((resource) => resource.id);

interface UseLeaderboardsArgs {
  contractId: string;
  /** Bump to reload (e.g. after a save). */
  refreshToken: number;
  connectReadOnly: () => Promise<DashSdk>;
  log: (message: string, level?: LogLevel) => void;
}

/**
 * The cross-resource views: "Top rated" and "Most reviewed" (two
 * `documents.ranked` calls) and the "4★+ average" set (`documents.having`).
 * Independent of the selected resource and of sign-in (read-only client),
 * so they load once per contract and on each `refreshToken` bump — not on
 * every selection. A failure is kept local (`leaderboardsError`) so it never
 * blocks the resource list.
 */
export function useLeaderboards({
  contractId,
  refreshToken,
  connectReadOnly,
  log,
}: UseLeaderboardsArgs) {
  const [leaderboards, setLeaderboards] = useState<Leaderboards | null>(null);
  const [leaderboardsLoading, setLeaderboardsLoading] = useState(false);
  const [leaderboardsError, setLeaderboardsError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    const isCurrent = () => id === requestId.current;
    (async () => {
      if (!contractId) {
        setLeaderboards(null);
        setLeaderboardsError("");
        setLeaderboardsLoading(false);
        return;
      }
      setLeaderboardsLoading(true);
      try {
        const sdk = await connectReadOnly();
        const args = { sdk, contractId, resourceIds: CATALOG_IDS };
        const [topRated, mostReviewed, highlyRated] = await Promise.all([
          getLeaderboard({ ...args, metric: "avg" }),
          getLeaderboard({ ...args, metric: "count" }),
          getResourcesWithMinAverage({
            ...args,
            minAverage: HIGHLY_RATED_MIN_AVERAGE,
          }),
        ]);
        if (!isCurrent()) return;
        setLeaderboards({
          topRated,
          mostReviewed,
          highlyRated: highlyRated.map((entry) => entry.resourceId),
        });
        setLeaderboardsError("");
      } catch (err) {
        if (!isCurrent()) return;
        const message = errorMessage(err);
        log(`Leaderboards failed: ${message}`);
        setLeaderboards(null);
        setLeaderboardsError(message);
      } finally {
        if (isCurrent()) setLeaderboardsLoading(false);
      }
    })();
    // refreshToken: reload on demand.
  }, [connectReadOnly, contractId, log, refreshToken]);

  return { leaderboards, leaderboardsLoading, leaderboardsError };
}
