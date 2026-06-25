import { useCallback, useEffect, useRef, useState } from "react";
import { RESOURCES } from "../catalog/resources";
import {
  findMyReviewForResource,
  getRatingCount,
  getRatingDistribution,
  listResourceReviews,
  summaryFromDistribution,
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
  connectReadOnly: () => Promise<DashSdk>;
  log: (message: string, level?: LogLevel) => void;
  setStatus: (message: string) => void;
}

export function useResourceRatings({
  contractId,
  session,
  selectedResourceId,
  connectReadOnly,
  log,
  setStatus,
}: UseResourceRatingsArgs) {
  const [summaries, setSummaries] = useState<Record<string, RatingSummary>>({});
  const [distributions, setDistributions] = useState<
    Record<string, RatingDistribution>
  >({});
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
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
    setMySelectedReview(null);
  }, []);

  const loadResourceData = useCallback(
    async (sdk?: DashSdk) => {
      const requestId = ++resourceRequestId.current;
      const isCurrentRequest = () => requestId === resourceRequestId.current;
      const scopedLog: Logger = (message, level = "info") => {
        if (isCurrentRequest()) log(message, level);
        else consoleLogger(message, level);
      };

      if (!contractId) {
        if (!isCurrentRequest()) return;
        clearResourceData();
        return;
      }

      const activeSdk = sdk ?? session?.sdk ?? (await connectReadOnly());
      const perResource = await Promise.all(
        RESOURCES.map(async (resource) => {
          const [totalCount, distribution] = await Promise.all([
            getRatingCount({
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
          ]);
          const summary = summaryFromDistribution(resource.id, distribution);
          return {
            resourceId: resource.id,
            summary: { ...summary, count: totalCount },
            distribution,
          };
        }),
      );

      if (!isCurrentRequest()) return;
      setSummaries(
        Object.fromEntries(
          perResource.map(({ resourceId, summary }) => [resourceId, summary]),
        ),
      );
      setDistributions(
        Object.fromEntries(
          perResource.map(({ resourceId, distribution }) => [
            resourceId,
            distribution,
          ]),
        ),
      );

      if (session) {
        const mine = await findMyReviewForResource({
          sdk: activeSdk,
          contractId,
          resourceId: selectedResourceId,
          ownerId: session.identityId,
          log: scopedLog,
        });
        if (!isCurrentRequest()) return;
        setMySelectedReview(mine);
        setRating(mine?.rating ?? null);
        setHoverRating(null);
        setReviewText(mine?.reviewText ?? "");
      }
    },
    [
      clearResourceData,
      connectReadOnly,
      contractId,
      log,
      selectedResourceId,
      session,
    ],
  );

  const refreshReviews = useCallback(
    async (sdk?: DashSdk) => {
      const requestId = ++reviewsRequestId.current;
      const isCurrentRequest = () => requestId === reviewsRequestId.current;
      const scopedLog: Logger = (message, level = "info") => {
        if (isCurrentRequest()) log(message, level);
        else consoleLogger(message, level);
      };

      if (!contractId) {
        if (!isCurrentRequest()) return [];
        setReviews([]);
        return [];
      }
      const activeSdk = sdk ?? session?.sdk ?? (await connectReadOnly());
      const list = await listResourceReviews({
        sdk: activeSdk,
        contractId,
        resourceId: selectedResourceId,
        ratingFilter: reviewFilter ?? undefined,
        log: scopedLog,
      });
      if (isCurrentRequest()) setReviews(list);
      return list;
    },
    [
      connectReadOnly,
      contractId,
      log,
      reviewFilter,
      selectedResourceId,
      session,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingRatings(Boolean(contractId));
      if (previousContractId.current !== contractId) {
        previousContractId.current = contractId;
        clearResourceData();
      }
      try {
        await loadResourceData();
        if (!cancelled) setStatus("");
      } catch (err) {
        if (!cancelled) setStatus(`Load failed: ${errorMessage(err)}`);
      } finally {
        if (!cancelled) setLoadingRatings(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearResourceData, contractId, loadResourceData, setStatus]);

  useEffect(() => {
    if (!contractId) return;
    const requestId = ++reviewsRequestId.current;
    const scopedLog: Logger = (message, level = "info") => {
      if (requestId === reviewsRequestId.current) log(message, level);
      else consoleLogger(message, level);
    };
    let cancelled = false;
    (async () => {
      try {
        const activeSdk = session?.sdk ?? (await connectReadOnly());
        const list = await listResourceReviews({
          sdk: activeSdk,
          contractId,
          resourceId: selectedResourceId,
          ratingFilter: reviewFilter ?? undefined,
          log: scopedLog,
        });
        if (!cancelled && requestId === reviewsRequestId.current) {
          setReviews(list);
        }
      } catch (err) {
        if (!cancelled && requestId === reviewsRequestId.current) {
          setStatus(`Reviews failed: ${errorMessage(err)}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    connectReadOnly,
    contractId,
    log,
    reviewFilter,
    selectedResourceId,
    session,
    setStatus,
  ]);

  return {
    summaries,
    distributions,
    reviews,
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
    loadResourceData,
    refreshReviews,
  };
}
