import type { ReviewRecord } from "../dash/queries";
import type { Session } from "../session/types";
import { formatAverage } from "../lib/format";
import { ownerLabel } from "../lib/ratings";
import { MyReviewCard } from "./MyReviewCard";

export function MyReviewsView({
  session,
  dpnsNames,
  myReviews,
  myReviewsLoading,
  myReviewsAverage,
  onEdit,
}: {
  session: Session | null;
  dpnsNames: Record<string, string | null>;
  myReviews: ReviewRecord[];
  myReviewsLoading: boolean;
  myReviewsAverage: number | null;
  onEdit: (review: ReviewRecord) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>My reviews</h2>
          {session && (
            <p className="panel-identity">
              <code>{ownerLabel(session.identityId, dpnsNames)}</code>
            </p>
          )}
        </div>
        {session && myReviews.length > 0 && (
          <p>
            {myReviews.length.toString()}{" "}
            {myReviews.length === 1 ? "review" : "reviews"} · you average{" "}
            <strong>{formatAverage(myReviewsAverage ?? 0)}</strong>
          </p>
        )}
      </div>
      {!session ? (
        <p>Sign in to see reviews written by your identity.</p>
      ) : myReviewsLoading ? (
        <p>Loading your reviews...</p>
      ) : myReviews.length === 0 ? (
        <p>No reviews from this identity yet.</p>
      ) : (
        <div className="reviews">
          {myReviews.map((review) => (
            <MyReviewCard key={review.id} review={review} onEdit={onEdit} />
          ))}
        </div>
      )}
    </section>
  );
}
