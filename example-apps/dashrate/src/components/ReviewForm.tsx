import type { FormEvent } from "react";

export function ReviewForm({
  signedIn,
  busy,
  contractId,
  rating,
  hoverRating,
  reviewText,
  hasSelectedReview,
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
  onSubmit: (event: FormEvent) => void;
  onOpenSettings: () => void;
  onRatingChange: (rating: number) => void;
  onHoverRatingChange: (rating: number | null) => void;
  onReviewTextChange: (text: string) => void;
  onLoadHistory: () => void;
}) {
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
          <div>
            <span className="field-label">
              How would you rate this resource?
            </span>
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
          </div>
          <label>
            Optional notes
            <textarea
              value={reviewText}
              onChange={(event) => onReviewTextChange(event.target.value)}
              maxLength={1000}
              rows={3}
              disabled={busy}
            />
          </label>
          <div className="row">
            <button
              type="submit"
              disabled={busy || !contractId || rating === null}
            >
              Save review
            </button>
            {hasSelectedReview && (
              <button type="button" onClick={onLoadHistory} disabled={busy}>
                View history
              </button>
            )}
          </div>
        </>
      )}
    </form>
  );
}
