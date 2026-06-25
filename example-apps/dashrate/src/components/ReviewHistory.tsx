import type { ReviewHistoryEntry } from "../dash/history";
import { formatDate } from "../lib/format";

export function ReviewHistory({ history }: { history: ReviewHistoryEntry[] }) {
  if (history.length === 0) return null;

  return (
    <section className="resource-section">
      <h3>Review history</h3>
      <ul className="review-list">
        {history.map((entry) => (
          <li
            key={`${entry.blockTimeMs}-${entry.revision}`}
            className="review-row"
          >
            <div className="review-row-head">
              <strong className="review-row-owner">
                Revision {entry.revision || "-"}: {entry.rating} stars
              </strong>
              <time className="review-row-meta">
                {formatDate(entry.blockTimeMs)}
              </time>
            </div>
            <p className="review-row-text">
              {entry.reviewText || "No review text."}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
