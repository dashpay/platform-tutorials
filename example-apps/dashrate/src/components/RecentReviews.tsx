import type { ReviewRecord } from "../dash/queries";
import { ownerLabel } from "../lib/ratings";
import { ReviewRow } from "./ReviewRow";

export function RecentReviews({
  reviews,
  reviewFilter,
  loadingRatings,
  dpnsNames,
  onClearFilter,
}: {
  reviews: ReviewRecord[];
  reviewFilter: number | null;
  loadingRatings: boolean;
  dpnsNames: Record<string, string | null>;
  onClearFilter: () => void;
}) {
  return (
    <section className="resource-section">
      <div className="review-list-head">
        <h3>
          {reviewFilter == null ? "Recent reviews" : `${reviewFilter}★ reviews`}
        </h3>
        {reviewFilter != null && (
          <button
            type="button"
            className="filter-clear"
            onClick={onClearFilter}
          >
            Clear filter
          </button>
        )}
      </div>
      {reviews.length === 0 ? (
        loadingRatings ? (
          <p className="inline-loading" role="status">
            <span className="mini-spinner" aria-hidden="true" />
            Loading reviews…
          </p>
        ) : (
          <p>
            {reviewFilter == null
              ? "No reviews yet."
              : `No ${reviewFilter}★ reviews yet.`}
          </p>
        )
      ) : (
        <ul className="review-list">
          {reviews.map((review) => (
            <ReviewRow
              key={review.id}
              review={review}
              ownerName={ownerLabel(review.ownerId, dpnsNames)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
