import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "../session/useSession";
import {
  listRatings,
  ownRating,
  ratingSummary,
  STAR_VALUES,
  type RatingRecord,
  type RatingSort,
  type RatingSummary,
  type Stars,
} from "../dash/ratingReads";
import {
  removeRating,
  saveRating,
  type RatingInput,
} from "../dash/ratingWrites";
import { errorMessage } from "../lib/logger";
import { formatAverage, pluralize, timeAgo } from "../lib/format";
import { DpnsName } from "./DpnsName";
import { ModalDialog } from "./ModalDialog";
import { SignInForm } from "./SignInForm";
import { StarMeter } from "./StarMeter";

const SORTS: { value: RatingSort; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
];

export function StarPicker({
  value,
  onChange,
  disabled = false,
  label = "Your rating",
}: {
  value: Stars | null;
  onChange(stars: Stars): void;
  disabled?: boolean;
  label?: string;
}) {
  const [hover, setHover] = useState<Stars | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <span
      className="star-picker"
      role="radiogroup"
      aria-label={label}
      onMouseLeave={() => setHover(null)}
    >
      {STAR_VALUES.map((stars) => (
        <button
          key={stars}
          type="button"
          role="radio"
          aria-checked={value === stars}
          aria-label={`${stars} ${stars === 1 ? "star" : "stars"}`}
          className={stars <= shown ? "star active" : "star"}
          disabled={disabled}
          onMouseEnter={() => setHover(stars)}
          onFocus={() => setHover(stars)}
          onBlur={() => setHover(null)}
          onClick={() => onChange(stars)}
        >
          {stars <= shown ? "★" : "☆"}
        </button>
      ))}
    </span>
  );
}

function RatingEditor({
  contractId,
  existing,
  initialStars,
  onCancel,
  onChanged,
}: {
  contractId: string;
  existing: RatingRecord | null;
  initialStars: Stars | null;
  onCancel(): void;
  onChanged(notice: string): void;
}) {
  const session = useSession();
  const [input, setInput] = useState<RatingInput>({
    stars: existing?.stars ?? initialStars,
    title: existing?.title ?? "",
    body: existing?.body ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!session.connection || !session.keyManager || !session.registryId)
    return null;
  async function run(action: () => Promise<string>) {
    setBusy(true);
    setError("");
    try {
      const notice = await action();
      void session.refreshBalance().catch(() => undefined);
      onChanged(notice);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="metadata-form rating-form"
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          const result = await saveRating({
            sdk: session.connection!.sdk,
            keyManager: session.keyManager!,
            registryId: session.registryId,
            targetId: contractId,
            input,
          });
          return result === "created" ? "Rating saved." : "Rating updated.";
        });
      }}
    >
      <h3>{existing ? "Edit your review" : "Write a review"}</h3>
      <p className="rating-form-note">
        One rating per identity. You can change or remove yours any time.
      </p>
      <StarPicker
        value={input.stars as Stars | null}
        disabled={busy}
        onChange={(stars) => setInput((previous) => ({ ...previous, stars }))}
      />
      <label>
        Title (optional)
        <input
          value={input.title}
          maxLength={120}
          placeholder="Sum it up in a few words"
          onChange={(event) =>
            setInput((previous) => ({ ...previous, title: event.target.value }))
          }
        />
      </label>
      <label>
        Review (optional)
        <textarea
          value={input.body}
          maxLength={1000}
          rows={4}
          placeholder="What worked, what didn't, what should others know?"
          onChange={(event) =>
            setInput((previous) => ({ ...previous, body: event.target.value }))
          }
        />
      </label>
      <div className="actions">
        <button disabled={busy || input.stars === null}>
          {busy ? "Saving…" : existing ? "Save changes" : "Submit rating"}
        </button>
        {existing && (
          <button
            className="danger"
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await removeRating({
                  sdk: session.connection!.sdk,
                  keyManager: session.keyManager!,
                  registryId: session.registryId,
                  rating: existing,
                });
                return "Rating removed.";
              })
            }
          >
            Remove rating
          </button>
        )}
        <button type="button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function RatingCard({
  rating,
  own,
  onEdit,
}: {
  rating: RatingRecord;
  own: boolean;
  onEdit?: () => void;
}) {
  const session = useSession();
  return (
    <li className={`rating-card${own ? " own" : ""}`}>
      <div className="rating-card-head">
        <span className="rating-avatar" aria-hidden="true">
          {rating.ownerId.slice(0, 1)}
        </span>
        <span className="rating-author">
          {session.connection ? (
            <DpnsName
              identityId={rating.ownerId}
              resolver={session.connection.names}
              nameOnly
            />
          ) : (
            <code>{rating.ownerId}</code>
          )}
        </span>
        <StarMeter value={rating.stars} className="small" />
        {own && <span className="entry-badge own">Your rating</span>}
        <time className="rating-time">
          {timeAgo(rating.updatedAt ?? rating.createdAt)}
        </time>
      </div>
      {rating.title && <strong className="rating-title">{rating.title}</strong>}
      <p className={rating.body ? "rating-body" : "rating-body muted"}>
        {rating.body || "Rated without a written review."}
      </p>
      {own && onEdit && (
        <button type="button" className="muted-pill" onClick={onEdit}>
          Edit
        </button>
      )}
    </li>
  );
}

export function AppRatings({
  contractId,
  onSummary,
}: {
  contractId: string;
  onSummary?(summary: RatingSummary | null): void;
}) {
  const session = useSession();
  const { connection, registryId, identityId } = session;
  const [sort, setSort] = useState<RatingSort>("recent");
  const [starsFilter, setStarsFilter] = useState<Stars>();
  const [writtenOnly, setWrittenOnly] = useState(false);
  const [quickStars, setQuickStars] = useState<Stars | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // Results carry the scope they were loaded for; a scope mismatch means the
  // data is stale (or still loading) and is not shown. No synchronous resets.
  const summaryScope = `${registryId}:${contractId}:${identityId ?? ""}:${refresh}`;
  const [summaryState, setSummaryState] = useState<{
    scope: string;
    summary?: RatingSummary;
    error: string;
    own?: RatingRecord | null;
  }>({ scope: "", error: "" });
  const summaryCurrent =
    summaryState.scope === summaryScope ? summaryState : undefined;
  const summary = summaryCurrent?.summary;
  const summaryError = summaryCurrent?.error ?? "";
  const own = summaryCurrent?.own;

  const listScope = `${registryId}:${contractId}:${sort}:${starsFilter ?? ""}:${refresh}`;
  const [listState, setListState] = useState<{
    scope: string;
    ratings: RatingRecord[];
    cursor?: string;
    error: string;
  }>({ scope: "", ratings: [], error: "" });
  const listCurrent = listState.scope === listScope ? listState : undefined;
  const ratings = listCurrent?.ratings ?? [];
  const listError = listCurrent?.error ?? "";
  const listBusy = Boolean(connection && registryId) && !listCurrent;

  useEffect(() => {
    if (!connection || !registryId) return;
    let active = true;
    void (async () => {
      const [summaryResult, ownResult] = await Promise.allSettled([
        ratingSummary(connection.sdk, registryId, contractId),
        identityId
          ? ownRating(connection.sdk, registryId, identityId, contractId)
          : Promise.resolve(null),
      ]);
      if (!active) return;
      const loaded =
        summaryResult.status === "fulfilled" ? summaryResult.value : undefined;
      setSummaryState({
        scope: summaryScope,
        summary: loaded,
        error:
          summaryResult.status === "rejected"
            ? errorMessage(summaryResult.reason)
            : "",
        own: ownResult.status === "fulfilled" ? ownResult.value : undefined,
      });
      onSummary?.(loaded ?? null);
    })();
    return () => {
      active = false;
    };
  }, [connection, registryId, identityId, contractId, summaryScope, onSummary]);

  useEffect(() => {
    if (!connection || !registryId) return;
    let active = true;
    void listRatings(connection.sdk, registryId, contractId, {
      sort,
      stars: starsFilter,
      cursor: undefined,
    })
      .then((page) => {
        if (active)
          setListState({
            scope: listScope,
            ratings: page.ratings,
            cursor: page.cursor,
            error: "",
          });
      })
      .catch((caught) => {
        if (active)
          setListState({
            scope: listScope,
            ratings: [],
            error: errorMessage(caught),
          });
      });
    return () => {
      active = false;
    };
  }, [connection, registryId, contractId, sort, starsFilter, listScope]);

  async function loadMore() {
    const cursor = listCurrent?.cursor;
    if (!connection || !registryId || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listRatings(connection.sdk, registryId, contractId, {
        sort,
        stars: starsFilter,
        cursor,
      });
      setListState((previous) =>
        previous.scope === listScope
          ? {
              ...previous,
              ratings: [
                ...new Map(
                  [...previous.ratings, ...page.ratings].map((rating) => [
                    rating.id,
                    rating,
                  ]),
                ).values(),
              ],
              cursor: page.cursor,
            }
          : previous,
      );
    } catch (caught) {
      setListState((previous) =>
        previous.scope === listScope
          ? { ...previous, error: errorMessage(caught) }
          : previous,
      );
    } finally {
      setLoadingMore(false);
    }
  }

  if (!registryId) return null;
  const count = summary?.count ?? 0n;
  const max = summary
    ? STAR_VALUES.reduce(
        (top, stars) =>
          summary.distribution[stars] > top ? summary.distribution[stars] : top,
        0n,
      )
    : 0n;
  const visible = writtenOnly
    ? ratings.filter((rating) => Boolean(rating.body))
    : ratings;
  const canWrite =
    Boolean(identityId && session.keyManager) && own !== undefined;
  const changed = (message: string) => {
    setEditorOpen(false);
    setQuickStars(null);
    setNotice(message);
    setRefresh((value) => value + 1);
  };
  return (
    <section className="app-ratings" aria-label="Ratings and reviews">
      <div className="panel-heading">
        <h2>Ratings &amp; reviews</h2>
        {summary && count > 0n && <span>{pluralize(count, "rating")}</span>}
      </div>
      {summaryError && (
        <p className="error" role="alert">
          Could not load the rating summary: {summaryError}
        </p>
      )}
      <div className="rating-overview">
        <div className="rating-average">
          <strong>{summary ? formatAverage(summary.average) : "–"}</strong>
          <StarMeter value={summary?.average ?? null} />
          <small>
            {!summary
              ? summaryError
                ? "Summary unavailable"
                : "Loading ratings…"
              : count === 0n
                ? "No ratings yet"
                : pluralize(count, "rating")}
          </small>
        </div>
        <div
          className="rating-histogram"
          role="group"
          aria-label="Ratings by star"
        >
          {[...STAR_VALUES].reverse().map((stars) => {
            const value = summary?.distribution[stars] ?? 0n;
            const width = max > 0n ? Number((value * 100n) / max) : 0;
            return (
              <button
                key={stars}
                type="button"
                className="rating-bar"
                aria-pressed={starsFilter === stars}
                aria-label={`${stars} ${stars === 1 ? "star" : "stars"}: ${value.toString()}`}
                onClick={() =>
                  setStarsFilter((previous) =>
                    previous === stars ? undefined : stars,
                  )
                }
              >
                <span>{stars}</span>
                <span className="rating-bar-track" aria-hidden="true">
                  <span style={{ width: `${width}%` }} />
                </span>
                <span>{value.toString()}</span>
              </button>
            );
          })}
        </div>
      </div>
      {identityId ? (
        <div className="rating-cta">
          <div>
            <strong>{own ? "Your rating" : "Used this app?"}</strong>
            <small>
              {own
                ? `Saved ${timeAgo(own.updatedAt ?? own.createdAt)}. You can change it any time.`
                : own === null
                  ? "One rating per identity. You can change yours any time."
                  : "Checking for your rating…"}
            </small>
          </div>
          {own ? (
            <StarMeter value={own.stars} />
          ) : (
            <StarPicker
              value={quickStars}
              disabled={!canWrite}
              onChange={(stars) => {
                setQuickStars(stars);
                setEditorOpen(true);
              }}
            />
          )}
          <button
            type="button"
            className="primary-pill"
            disabled={!canWrite}
            onClick={() => setEditorOpen(true)}
          >
            {own ? "Edit review" : "Write a review"}
          </button>
        </div>
      ) : signingIn ? (
        <div className="category-signin-form">
          <SignInForm onClose={() => setSigningIn(false)} />
        </div>
      ) : (
        <div className="rating-cta">
          <div>
            <strong>Used this app?</strong>
            <small>Sign in to rate it. One rating per identity.</small>
          </div>
          <button
            type="button"
            className="sign-in-pill"
            disabled={!connection || session.network === "mainnet"}
            onClick={() => setSigningIn(true)}
          >
            {session.network === "mainnet" ? "Testnet only" : "Sign in to rate"}
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="rating-toolbar">
        <div className="segment" aria-label="Sort ratings">
          {SORTS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={sort === option.value}
              disabled={starsFilter !== undefined}
              onClick={() => setSort(option.value)}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={writtenOnly}
            onClick={() => setWrittenOnly((value) => !value)}
          >
            Written only
          </button>
        </div>
        {starsFilter !== undefined && (
          <p className="rating-filter-note">
            Showing {starsFilter}-star ratings only.{" "}
            <button
              type="button"
              className="link-button"
              onClick={() => setStarsFilter(undefined)}
            >
              Clear filter
            </button>
          </p>
        )}
      </div>
      {listError && (
        <p className="error" role="alert">
          Could not load ratings: {listError}
        </p>
      )}
      {listBusy && <p role="status">Loading ratings…</p>}
      {!listBusy && !listError && !visible.length && (
        <p className="rating-empty">
          {starsFilter !== undefined
            ? `No ${starsFilter}-star ratings yet.`
            : writtenOnly && ratings.length
              ? "No written reviews on this page."
              : "No ratings yet. Be the first to rate this app."}
        </p>
      )}
      <ul className="rating-list">
        {visible.map((rating) => (
          <RatingCard
            key={rating.id}
            rating={rating}
            own={rating.ownerId === identityId}
            onEdit={canWrite ? () => setEditorOpen(true) : undefined}
          />
        ))}
      </ul>
      {listCurrent?.cursor && (
        <button
          type="button"
          className="open-pill"
          disabled={loadingMore}
          onClick={() => void loadMore()}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
      {editorOpen &&
        canWrite &&
        createPortal(
          <ModalDialog
            label={own ? "Edit your review" : "Write a review"}
            onClose={() => setEditorOpen(false)}
          >
            <RatingEditor
              key={`${own?.id ?? "new"}:${own?.revision ?? 0}:${quickStars ?? ""}`}
              contractId={contractId}
              existing={own ?? null}
              initialStars={quickStars}
              onCancel={() => setEditorOpen(false)}
              onChanged={changed}
            />
          </ModalDialog>,
          document.body,
        )}
    </section>
  );
}
