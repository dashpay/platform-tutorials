import { findResource } from "../catalog/resources";
import type { ReviewRecord } from "../dash/queries";
import { formatDate } from "../lib/format";
import { stars } from "../lib/ratings";

export function MyReviewCard({
  review,
  onEdit,
}: {
  review: ReviewRecord;
  onEdit: (review: ReviewRecord) => void;
}) {
  const resource = findResource(review.resourceId);
  const title = resource?.title ?? review.resourceId;
  return (
    <article className="my-review-card">
      <div className="my-review-head">
        <div className="my-review-title">
          {resource && <span>{resource.category}</span>}
          <strong>{title}</strong>
        </div>
        <div className="my-review-rating">
          <strong className="review-rating">{stars(review.rating)}</strong>
          <time>edited {formatDate(review.updatedAt ?? review.createdAt)}</time>
        </div>
      </div>
      <p>{review.reviewText || "No written review."}</p>
      <div className="my-review-actions">
        <button type="button" onClick={() => onEdit(review)}>
          Edit review
        </button>
        {resource && (
          <a
            className="secondary-action"
            href={resource.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open resource ↗
          </a>
        )}
      </div>
    </article>
  );
}
