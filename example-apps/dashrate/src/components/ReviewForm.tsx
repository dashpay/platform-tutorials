import type { FormEvent } from "react";
import type { ReviewHistoryEntry } from "../dash/history";
import { ReviewHistory } from "./ReviewHistory";

export function ReviewForm({
  signedIn,
  busy,
  contractId,
  rating,
  hoverRating,
  reviewText,
  hasSelectedReview,
  history,
  onSubmit,
  onOpenSettings,
  onRatingChange,
  onHoverRatingChange,
  onReviewTextChange,
  onLoadHistory,
}: {
  signedIn: boolean;
  busy: boolean;
  contractId: string;
  rating: number | null;
  hoverRating: number | null;
  reviewText: string;
  hasSelectedReview: boolean;
  history: ReviewHistoryEntry[];
  onSubmit: (event: FormEvent) => void;
  onOpenSettings: () => void;
  onRatingChange: (rating: number) => void;
  onHoverRatingChange: (rating: number | null) => void;
  onReviewTextChange: (text: string) => void;
  onLoadHistory: () => void;
}) {
  const historyOpen = history.length > 0;
  const displayRating = hoverRating ?? rating ?? 0;

  return (
    <form className="resource-section review-form" onSubmit={onSubmit}>
      <h3>Your review</h3>
      {!signedIn ? (
        <div className="signin-cta">
          <p>Sign in to review this resource</p>
          <button
            type="button"
            className="signin-cta-button"
            onClick={onOpenSettings}
          >
            Sign in
          </button>
        </div>
      ) : (
        <>
          <div
            className="star-picker"
            role="radiogroup"
            aria-label="Rating"
            onMouseLeave={() => onHoverRatingChange(null)}
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={value <= displayRating ? "star active" : "star"}
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} star${value === 1 ? "" : "s"}`}
                onMouseEnter={() => onHoverRatingChange(value)}
                onFocus={() => onHoverRatingChange(value)}
                onBlur={() => onHoverRatingChange(null)}
                onClick={() => onRatingChange(value)}
                disabled={busy}
              >
                {value <= displayRating ? "★" : "☆"}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="review-comment">
            Review comment
          </label>
          <textarea
            id="review-comment"
            value={reviewText}
            onChange={(event) => onReviewTextChange(event.target.value)}
            placeholder="Share what worked, what was unclear, or what others should know."
            maxLength={1000}
            rows={3}
            disabled={busy}
          />
          <div className="row">
            <button
              type="submit"
              disabled={busy || !contractId || rating === null}
            >
              Save review
            </button>
          </div>
          {hasSelectedReview && (
            <button
              type="button"
              className="text-toggle"
              onClick={onLoadHistory}
              disabled={busy}
              aria-expanded={historyOpen}
            >
              {historyOpen
                ? "Hide previous versions"
                : "Show previous versions"}
            </button>
          )}
          {historyOpen && <ReviewHistory history={history} />}
        </>
      )}
    </form>
  );
}
