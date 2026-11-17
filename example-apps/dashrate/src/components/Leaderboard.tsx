import { useState } from "react";
import { findResource } from "../catalog/resources";
import type { LeaderboardEntry } from "../dash/leaderboard";
import { formatAverage } from "../lib/format";

type Board = "topRated" | "mostReviewed";

const BOARDS: Array<{ key: Board; label: string }> = [
  { key: "topRated", label: "Top rated" },
  { key: "mostReviewed", label: "Most reviewed" },
];

/** How many places each board shows. */
const BOARD_SIZE = 5;

/**
 * "Top rated" (ranked by average) and "Most reviewed" (ranked by count),
 * one at a time behind a two-button switch. Each row selects its resource.
 */
export function Leaderboard({
  topRated,
  mostReviewed,
  loading,
  error,
  selectedResourceId,
  onSelectResource,
}: {
  topRated: LeaderboardEntry[];
  mostReviewed: LeaderboardEntry[];
  loading: boolean;
  error: string;
  selectedResourceId: string;
  onSelectResource: (resourceId: string) => void;
}) {
  const [board, setBoard] = useState<Board>("topRated");
  const entries = (board === "topRated" ? topRated : mostReviewed).slice(
    0,
    BOARD_SIZE,
  );

  let body;
  if (error) {
    body = <p className="leaderboard-empty">Leaderboard unavailable.</p>;
  } else if (entries.length === 0) {
    body = loading ? (
      <p className="inline-loading leaderboard-empty" role="status">
        <span className="mini-spinner" aria-hidden="true" />
        Loading…
      </p>
    ) : (
      <p className="leaderboard-empty">No ratings yet.</p>
    );
  } else {
    body = (
      <ol className="leaderboard-list">
        {entries.map((entry, index) => {
          const title =
            findResource(entry.resourceId)?.title ?? entry.resourceId;
          const value =
            board === "topRated"
              ? `${formatAverage(entry.value)} ★`
              : `${entry.value} ${entry.value === 1 ? "review" : "reviews"}`;
          return (
            <li key={entry.resourceId}>
              <button
                type="button"
                className={
                  entry.resourceId === selectedResourceId
                    ? "leaderboard-row selected"
                    : "leaderboard-row"
                }
                data-resource-id={entry.resourceId}
                onClick={() => onSelectResource(entry.resourceId)}
              >
                <span className="leaderboard-rank">{index + 1}</span>
                <span className="leaderboard-title">{title}</span>
                <span className="leaderboard-value">{value}</span>
              </button>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <section className="leaderboard" aria-label="Leaderboards">
      <div className="leaderboard-tabs" role="group" aria-label="Leaderboard">
        {BOARDS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={
              key === board ? "leaderboard-tab active" : "leaderboard-tab"
            }
            aria-pressed={key === board}
            onClick={() => setBoard(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {body}
    </section>
  );
}
