import type { ReviewRecord } from "../dash/queries";
import { formatDate } from "../lib/format";
import { stars } from "../lib/ratings";

export function ReviewRow({
  review,
  ownerName,
}: {
  review: ReviewRecord;
  ownerName: string;
}) {
  return (
    <li className="review-row">
      <div className="review-row-head">
        <code className="review-row-owner">{ownerName}</code>
        <span className="review-row-sep" aria-hidden="true">
          ·
        </span>
        <strong className="review-rating">{stars(review.rating)}</strong>
      </div>
      <p className="review-row-text">
        {review.reviewText || "No written review."}
      </p>
      <time className="review-row-meta">
        {formatDate(review.updatedAt ?? review.createdAt)}
      </time>
    </li>
  );
}
