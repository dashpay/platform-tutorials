import { useCallback, useEffect, useState } from "react";
import { listMyReviews, type ReviewRecord } from "../dash/queries";
import { errorMessage, type LogLevel } from "../lib/logger";
import type { Session } from "../session/types";

interface UseMyReviewsArgs {
  contractId: string;
  enabled: boolean;
  session: Session | null;
  log: (message: string, level?: LogLevel) => void;
}

export function useMyReviews({
  contractId,
  enabled,
  session,
  log,
}: UseMyReviewsArgs) {
  const [myReviews, setMyReviews] = useState<ReviewRecord[]>([]);
  const [myReviewsLoading, setMyReviewsLoading] = useState(false);
  const myReviewsAverage =
    myReviews.length === 0
      ? null
      : myReviews.reduce((total, review) => total + review.rating, 0) /
        myReviews.length;

  const fetchMyReviews = useCallback(
    async (activeSession: Session): Promise<ReviewRecord[]> => {
      if (!contractId) return [];
      return listMyReviews({
        sdk: activeSession.sdk,
        contractId,
        ownerId: activeSession.identityId,
        log,
      });
    },
    [contractId, log],
  );

  const refreshMyReviews = useCallback(
    async (activeSession = session) => {
      if (!activeSession) return [];
      const fetched = await fetchMyReviews(activeSession);
      setMyReviews(fetched);
      return fetched;
    },
    [fetchMyReviews, session],
  );

  useEffect(() => {
    if (!enabled || !session || !contractId) return;
    let cancelled = false;
    (async () => {
      setMyReviewsLoading(true);
      try {
        const fetched = await fetchMyReviews(session);
        if (!cancelled) setMyReviews(fetched);
      } catch (err) {
        if (!cancelled) log(`My reviews failed: ${errorMessage(err)}`, "error");
      } finally {
        if (!cancelled) setMyReviewsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contractId, enabled, fetchMyReviews, log, session]);

  return {
    myReviews,
    setMyReviews,
    myReviewsLoading,
    myReviewsAverage,
    fetchMyReviews,
    refreshMyReviews,
  };
}
