import { useCallback, useEffect, useRef, useState } from "react";
import { RESOURCES } from "../catalog/resources";
import {
  findMyReviewForResource,
  getRatingDistribution,
  getRatingSummary,
  listResourceReviews,
  type RatingDistribution,
  type RatingSummary,
  type ReviewRecord,
} from "../dash/queries";
import type { DashSdk } from "../dash/types";
import { emptyDistribution, emptySummary } from "../lib/ratings";
import {
  consoleLogger,
  errorMessage,
  type Logger,
  type LogLevel,
} from "../lib/logger";
import type { Session } from "../session/types";

interface UseResourceRatingsArgs {
  contractId: string;
  session: Session | null;
  selectedResourceId: string;
  /**
   * Bump to reload everything for the CURRENT selection (e.g. after a
   * save). A token, not a callback, so a refresh can never run against a
   * resource the user has since navigated away from.
   */
  refreshToken: number;
  connectReadOnly: () => Promise<DashSdk>;
  log: (message: string, level?: LogLevel) => void;
  setStatus: (message: string) => void;
}

export function useResourceRatings({
  contractId,
  session,
  selectedResourceId,
  refreshToken,
  connectReadOnly,
  log,
  setStatus,
}: UseResourceRatingsArgs) {
  const [summaries, setSummaries] = useState<Record<string, RatingSummary>>({});
  const [distributions, setDistributions] = useState<
    Record<string, RatingDistribution>
  >({});
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  // Cursor for the next server-side page (the last shown review's ID), or
  // null when the list is complete.
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMoreReviews, setLoadingMoreReviews] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<number | null>(null);
  const [reviewsKeyShown, setReviewsKeyShown] = useState(
    `${selectedResourceId}::${reviewFilter ?? "all"}`,
  );
  const [mySelectedReview, setMySelectedReview] = useState<ReviewRecord | null>(
    null,
  );
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [loadingRatings, setLoadingRatings] = useState(false);
  const resourceRequestId = useRef(0);
  const reviewsRequestId = useRef(0);
  const previousContractId = useRef(contractId);

  const reviewsKey = `${selectedResourceId}::${reviewFilter ?? "all"}`;
  if (reviewsKeyShown !== reviewsKey) {
    setReviewsKeyShown(reviewsKey);
    setReviews([]);
    setNextCursor(null);
    setLoadingMoreReviews(false);
  }

  const clearResourceData = useCallback(() => {
    setSummaries(
      Object.fromEntries(
        RESOURCES.map((resource) => [resource.id, emptySummary(resource.id)]),
      ),
    );
    setDistributions(
      Object.fromEntries(
        RESOURCES.map((resource) => [resource.id, emptyDistribution()]),
      ),
    );
    setReviews([]);
    setNextCursor(null);
    setMySelectedReview(null);
  }, []);

  /**
   * Load every resource's summary + distribution (and, signed in, the
   * viewer's review of the selected resource). One resource failing keeps
   * its previous data and doesn't blank the others.
   */
  const loadResourceData = useCallback(async (): Promise<void> => {
    const requestId = ++resourceRequestId.current;
    const isCurrentRequest = () => requestId === resourceRequestId.current;
    const scopedLog: Logger = (message, level = "info") => {
      if (isCurrentRequest()) log(message, level);
      else consoleLogger(message, level);
    };

    if (!contractId) {
      if (isCurrentRequest()) clearResourceData();
      return;
    }

    const activeSdk = session?.sdk ?? (await connectReadOnly());
    const results = await Promise.all(
      RESOURCES.map(async (resource) => {
        // Proven (count, sum) → average, and the per-star histogram.
        // The helpers log their own failure; null marks it.
        const pair = await Promise.all([
          getRatingSummary({
            sdk: activeSdk,
            contractId,
            resourceId: resource.id,
            log: scopedLog,
          }),
          getRatingDistribution({
            sdk: activeSdk,
            contractId,
            resourceId: resource.id,
            log: scopedLog,
          }),
        ]).catch(() => null);
        if (!pair) return null;
        const [summary, distribution] = pair;
        return { resourceId: resource.id, summary, distribution };
      }),
    );
    const loaded = results.filter((result) => result !== null);

    if (!isCurrentRequest()) return;
    setSummaries((current) => ({
      ...current,
      ...Object.fromEntries(
        loaded.map(({ resourceId, summary }) => [resourceId, summary]),
      ),
    }));
    setDistributions((current) => ({
      ...current,
      ...Object.fromEntries(
        loaded.map(({ resourceId, distribution }) => [
          resourceId,
          distribution,
        ]),
      ),
    }));
    scopedLog(`Loaded ratings for ${loaded.length} resources.`);

    if (session) {
      const mine = await findMyReviewForResource({
        sdk: activeSdk,
        contractId,
        resourceId: selectedResourceId,
        ownerId: session.identityId,
      });
      if (!isCurrentRequest()) return;
      setMySelectedReview(mine);
      setRating(mine?.rating ?? null);
      setHoverRating(null);
      setReviewText(mine?.reviewText ?? "");
    }
  }, [
    clearResourceData,
    connectReadOnly,
    contractId,
    log,
    selectedResourceId,
    session,
  ]);

  const refreshReviews = useCallback(async (): Promise<void> => {
    const requestId = ++reviewsRequestId.current;
    const isCurrentRequest = () => requestId === reviewsRequestId.current;
    const scopedLog: Logger = (message, level = "info") => {
      if (isCurrentRequest()) log(message, level);
      else consoleLogger(message, level);
    };

    if (!contractId) {
      if (!isCurrentRequest()) return;
      setReviews([]);
      setNextCursor(null);
      return;
    }
    try {
      const activeSdk = session?.sdk ?? (await connectReadOnly());
      const page = await listResourceReviews({
        sdk: activeSdk,
        contractId,
        resourceId: selectedResourceId,
        ratingFilter: reviewFilter ?? undefined,
        log: scopedLog,
      });
      if (isCurrentRequest()) {
        setReviews(page.reviews);
        setNextCursor(page.nextCursor);
      }
    } catch (err) {
      if (isCurrentRequest()) {
        setStatus(`Reviews failed: ${errorMessage(err)}`);
      }
    } finally {
      // A Load more that was in flight was dropped by this refresh,
      // whether the refresh succeeded or not.
      if (isCurrentRequest()) setLoadingMoreReviews(false);
    }
  }, [
    connectReadOnly,
    contractId,
    log,
    reviewFilter,
    selectedResourceId,
    session,
    setStatus,
  ]);

  /**
   * Append the next newest-first page: the same query with `startAfter`
   * set to the last review shown. Shares the request-id guard with
   * refreshReviews, so a resource/filter switch mid-flight drops the page.
   */
  const loadMoreReviews = useCallback(async () => {
    if (!contractId || !nextCursor) return;
    const requestId = reviewsRequestId.current;
    const isCurrentRequest = () => requestId === reviewsRequestId.current;
    setLoadingMoreReviews(true);
    try {
      const activeSdk = session?.sdk ?? (await connectReadOnly());
      const page = await listResourceReviews({
        sdk: activeSdk,
        contractId,
        resourceId: selectedResourceId,
        ratingFilter: reviewFilter ?? undefined,
        startAfter: nextCursor,
        log: (message, level = "info") => {
          if (isCurrentRequest()) log(message, level);
          else consoleLogger(message, level);
        },
      });
      if (!isCurrentRequest()) return;
      setReviews((current) => {
        const seen = new Set(current.map((review) => review.id));
        return [
          ...current,
          ...page.reviews.filter((review) => !seen.has(review.id)),
        ];
      });
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (isCurrentRequest()) {
        setStatus(`More reviews failed: ${errorMessage(err)}`);
      }
    } finally {
      // A stale request leaves the flag to whoever replaced its list.
      if (isCurrentRequest()) setLoadingMoreReviews(false);
    }
  }, [
    connectReadOnly,
    contractId,
    log,
    nextCursor,
    reviewFilter,
    selectedResourceId,
    session,
    setStatus,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingRatings(Boolean(contractId));
      if (previousContractId.current !== contractId) {
        previousContractId.current = contractId;
        clearResourceData();
      }
      try {
        // A resource that failed has already logged (and surfaced) its
        // own error; the status line is cleared when the user moves on.
        await loadResourceData();
      } catch (err) {
        if (cancelled) return;
        setStatus(`Load failed: ${errorMessage(err)}`);
      } finally {
        if (!cancelled) setLoadingRatings(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // refreshToken: reload on demand (see UseResourceRatingsArgs).
  }, [
    clearResourceData,
    contractId,
    loadResourceData,
    refreshToken,
    setStatus,
  ]);

  // One loader for the list: runs on contract/resource/filter change (via
  // refreshReviews' identity) and on refreshToken. With no contract it
  // still runs, so an in-flight page for the old contract is superseded.
  useEffect(() => {
    void refreshReviews();
  }, [refreshReviews, refreshToken]);

  return {
    summaries,
    distributions,
    reviews,
    hasMoreReviews: nextCursor !== null,
    loadingMoreReviews,
    loadMoreReviews,
    reviewFilter,
    setReviewFilter,
    mySelectedReview,
    setMySelectedReview,
    rating,
    setRating,
    hoverRating,
    setHoverRating,
    reviewText,
    setReviewText,
    loadingRatings,
  };
}
