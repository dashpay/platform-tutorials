import { useRef, type FormEvent } from "react";
import { RESOURCES, type RatedResource } from "../catalog/resources";
import type {
  RatingDistribution,
  RatingSummary,
  ReviewRecord,
} from "../dash/queries";
import type { ReviewHistoryEntry } from "../dash/history";
import {
  emptyDistribution,
  emptySummary,
  RATING_ROWS,
  reviewCountLine,
} from "../lib/ratings";
import { formatAverage } from "../lib/format";
import { StarMeter } from "./StarMeter";
import { ReviewForm } from "./ReviewForm";
import { RecentReviews } from "./RecentReviews";

export function ResourcesView({
  selectedResource,
  summaries,
  distributions,
  reviews,
  reviewFilter,
  loadingRatings,
  history,
  signedIn,
  busy,
  contractId,
  rating,
  hoverRating,
  reviewText,
  hasSelectedReview,
  dpnsNames,
  onSelectResource,
  onReviewFilterChange,
  onSaveReview,
  onOpenSettings,
  onRatingChange,
  onHoverRatingChange,
  onReviewTextChange,
  onLoadHistory,
}: {
  selectedResource: RatedResource;
  summaries: Record<string, RatingSummary>;
  distributions: Record<string, RatingDistribution>;
  reviews: ReviewRecord[];
  reviewFilter: number | null;
  loadingRatings: boolean;
  history: ReviewHistoryEntry[];
  signedIn: boolean;
  busy: boolean;
  contractId: string;
  rating: number | null;
  hoverRating: number | null;
  reviewText: string;
  hasSelectedReview: boolean;
  dpnsNames: Record<string, string | null>;
  onSelectResource: (resourceId: string) => void;
  onReviewFilterChange: (rating: number | null) => void;
  onSaveReview: (event: FormEvent) => void;
  onOpenSettings: () => void;
  onRatingChange: (rating: number) => void;
  onHoverRatingChange: (rating: number | null) => void;
  onReviewTextChange: (text: string) => void;
  onLoadHistory: () => void;
}) {
  const detailRef = useRef<HTMLElement>(null);

  // On the stacked mobile layout the resource list sits above the detail
  // panel, so a tap leaves the rating/reviews off-screen. Scroll the detail
  // into view there; on the two-column desktop layout both are already
  // visible, so leave the scroll position alone.
  function handleSelectResource(resourceId: string) {
    onSelectResource(resourceId);
    if (window.matchMedia("(max-width: 820px)").matches) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const selectedSummary =
    summaries[selectedResource.id] ?? emptySummary(selectedResource.id);
  const selectedDistribution =
    distributions[selectedResource.id] ?? emptyDistribution();
  const distributionMax = RATING_ROWS.reduce<bigint>((max, value) => {
    const count = selectedDistribution[value] ?? 0n;
    return count > max ? count : max;
  }, 0n);

  return (
    <section className="workspace">
      <aside className="resource-list" aria-label="Tutorial resources">
        {RESOURCES.map((resource) => {
          const summary = summaries[resource.id] ?? emptySummary(resource.id);
          return (
            <button
              key={resource.id}
              className={
                resource.id === selectedResource.id
                  ? "resource-card selected"
                  : "resource-card"
              }
              onClick={() => handleSelectResource(resource.id)}
            >
              <span className="resource-category">{resource.category}</span>
              <strong>{resource.title}</strong>
              <small
                className={
                  summary.count === 0n ? "rating-empty" : "rating-present"
                }
              >
                {summary.count > 0n && (
                  <StarMeter className="mini-stars" value={summary.average} />
                )}
                {reviewCountLine(summary)}
              </small>
            </button>
          );
        })}
      </aside>

      <section className="detail" ref={detailRef}>
        <div className="detail-head">
          <p className="eyebrow">{selectedResource.category}</p>
          <div className="detail-title-row">
            <h2>{selectedResource.title}</h2>
            <div className="detail-actions">
              <a
                className="resource-open"
                href={selectedResource.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open ↗
              </a>
            </div>
          </div>
          <p className="detail-summary">{selectedResource.summary}</p>
          <div className="detail-rating" aria-label="Aggregate rating stats">
            <strong className="detail-rating-score">
              {selectedSummary.average === null
                ? "—"
                : formatAverage(selectedSummary.average)}
            </strong>
            <StarMeter
              className="detail-rating-stars"
              value={selectedSummary.average}
            />
            <span className="detail-rating-count muted">
              {reviewCountLine(selectedSummary)}
            </span>
          </div>
          {selectedSummary.count > 0n && (
            <ul className="rating-histogram" aria-label="Rating distribution">
              {RATING_ROWS.map((value) => {
                const count = selectedDistribution[value] ?? 0n;
                const widthPercent =
                  distributionMax > 0n
                    ? Number((count * 100n) / distributionMax)
                    : 0;
                const active = reviewFilter === value;
                return (
                  <li key={value}>
                    <button
                      type="button"
                      className={
                        active ? "histogram-row active" : "histogram-row"
                      }
                      aria-pressed={active}
                      onClick={() =>
                        onReviewFilterChange(active ? null : value)
                      }
                    >
                      <span className="histogram-label">{value}★</span>
                      <span className="histogram-track" aria-hidden="true">
                        <span
                          className={
                            count > 0n
                              ? "histogram-bar"
                              : "histogram-bar empty"
                          }
                          style={{ width: `${widthPercent}%` }}
                        />
                      </span>
                      <span className="histogram-count">
                        {count.toString()} {count === 1n ? "review" : "reviews"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <ReviewForm
          signedIn={signedIn}
          busy={busy}
          contractId={contractId}
          rating={rating}
          hoverRating={hoverRating}
          reviewText={reviewText}
          hasSelectedReview={hasSelectedReview}
          history={history}
          onSubmit={onSaveReview}
          onOpenSettings={onOpenSettings}
          onRatingChange={onRatingChange}
          onHoverRatingChange={onHoverRatingChange}
          onReviewTextChange={onReviewTextChange}
          onLoadHistory={onLoadHistory}
        />

        <RecentReviews
          reviews={reviews}
          reviewFilter={reviewFilter}
          loadingRatings={loadingRatings}
          dpnsNames={dpnsNames}
          onClearFilter={() => onReviewFilterChange(null)}
        />
      </section>
    </section>
  );
}
