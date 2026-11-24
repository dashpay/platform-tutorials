import { useState } from "react";
import type { RegistryEntry } from "../dash/registryReads";
import type { Leaderboards } from "../hooks/useLeaderboards";
import { formatAverage, pluralize } from "../lib/format";

type Board = "topRated" | "mostRated";

const BOARDS: { key: Board; label: string }[] = [
  { key: "topRated", label: "Top rated" },
  { key: "mostRated", label: "Most rated" },
];

const BOARD_SIZE = 5;

/** "Top rated" and "Most rated" behind a two-button switch. */
export function Leaderboard({
  leaderboards,
  loading,
  error,
  open,
}: {
  leaderboards: Leaderboards | null;
  loading: boolean;
  error: string;
  open(id: string, name: string, entry?: RegistryEntry): void;
}) {
  const [board, setBoard] = useState<Board>("topRated");
  const entries = (leaderboards?.[board] ?? []).slice(0, BOARD_SIZE);
  const anyCommunity = entries.some(
    (entry) => leaderboards?.names.get(entry.contractId)?.official === false,
  );
  return (
    <section className="panel side-panel" aria-label="Leaderboards">
      <h2>Leaderboard</h2>
      <div className="segment" role="group" aria-label="Leaderboard">
        {BOARDS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={board === key}
            onClick={() => setBoard(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? (
        <p>Leaderboard unavailable.</p>
      ) : !entries.length ? (
        <p role={loading ? "status" : undefined}>
          {loading ? "Loading…" : "No reviews yet."}
        </p>
      ) : (
        <ol className="side-list">
          {entries.map((entry) => {
            const named = leaderboards!.names.get(entry.contractId);
            const average = leaderboards!.averages.get(entry.contractId);
            // Ties come back in no particular order, so they share a rank.
            const rank =
              entries.findIndex((other) => other.value === entry.value) + 1;
            const name =
              named?.name ??
              `${entry.contractId.slice(0, 6)}…${entry.contractId.slice(-4)}`;
            return (
              <li key={entry.contractId}>
                <button
                  type="button"
                  className="side-row"
                  onClick={() => open(entry.contractId, name, named?.entry)}
                >
                  <span className="side-row-rank">{rank}</span>
                  <span className="side-row-title">
                    {name}
                    {named && !named.official && <small>Community name</small>}
                  </span>
                  <span className="side-row-value">
                    ★ {formatAverage(average?.average ?? null)}
                    <small>{pluralize(average?.count ?? 0n, "review")}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {anyCommunity && (
        <small>
          A community name comes from the newest listing, since no owner has
          marked one official. Anyone can write it.
        </small>
      )}
    </section>
  );
}
