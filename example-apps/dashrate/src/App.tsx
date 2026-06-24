import { useCallback, useEffect, useMemo, useState } from "react";
import { RESOURCES } from "./catalog/resources";
import {
  clearStoredContractId,
  loadStoredContractId,
  registerContract,
  saveContractId,
} from "./dash/contract";
import { fetchReviewHistory, type ReviewHistoryEntry } from "./dash/history";
import {
  findMyReviewForResource,
  getRatingCount,
  getRatingDistribution,
  listMyReviews,
  listResourceReviews,
  summaryFromDistribution,
  type RatingDistribution,
  type RatingSummary,
  type ReviewRecord,
} from "./dash/queries";
import { resolveDpnsName } from "./dash/resolveDpnsName";
import { saveReview } from "./dash/review";
import type { DashKeyManager, DashSdk } from "./dash/types";
import { consoleLogger, errorMessage, type LogLevel } from "./lib/logger";
import { formatAverage, formatDate, shortId } from "./lib/format";

type SdkCore = typeof import("../../../setupDashClient-core.mjs");

let sdkCorePromise: Promise<SdkCore> | null = null;
function loadSdkCore(): Promise<SdkCore> {
  if (!sdkCorePromise) {
    sdkCorePromise = import("../../../setupDashClient-core.mjs").catch(
      (err) => {
        sdkCorePromise = null;
        throw err;
      },
    );
  }
  return sdkCorePromise;
}

interface Session {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  identityId: string;
}

type View = "resources" | "my-reviews" | "settings" | "how";

const emptySummary = (resourceId: string): RatingSummary => ({
  resourceId,
  count: 0n,
  sum: 0n,
  average: null,
});

const emptyDistribution = (): RatingDistribution => ({
  1: 0n,
  2: 0n,
  3: 0n,
  4: 0n,
  5: 0n,
});

// Histogram rows render high-to-low, matching the convention of 5★ on top.
const RATING_ROWS = [5, 4, 3, 2, 1] as const;

// Display an identity as its DPNS name (if resolved) or a short ID fallback.
function ownerLabel(
  ownerId: string,
  dpnsNames: Record<string, string | null>,
): string {
  const name = dpnsNames[ownerId];
  return name ? name : shortId(ownerId);
}

function stars(value: number | null): string {
  if (value === null) return "No rating";
  const rounded = Math.round(value);
  return "★★★★★".slice(0, rounded) + "☆☆☆☆☆".slice(0, 5 - rounded);
}

// Renders five stars with the gold fill clipped to the exact average,
// so 2.5 shows as a half-filled third star. Used for aggregate ratings
// (sidebar + detail), not the whole-number picker or individual reviews.
function StarMeter({
  value,
  className,
}: {
  value: number | null;
  className?: string;
}) {
  const fillPercent = value === null ? 0 : Math.max(0, Math.min(5, value)) * 20;
  const label =
    value === null ? "No rating yet" : `${formatAverage(value)} out of 5`;
  return (
    <span
      className={className ? `star-meter ${className}` : "star-meter"}
      role="img"
      aria-label={label}
    >
      <span className="star-meter-track" aria-hidden="true">
        ★★★★★
      </span>
      <span
        className="star-meter-fill"
        aria-hidden="true"
        style={{ width: `${fillPercent}%` }}
      >
        ★★★★★
      </span>
    </span>
  );
}

function reviewCountLine(summary: RatingSummary): string {
  if (summary.count === 0n || summary.average === null) return "No reviews yet";
  const noun = summary.count === 1n ? "review" : "reviews";
  return `${summary.count.toString()} ${noun}`;
}

export default function App() {
  const [contractId, setContractId] = useState(loadStoredContractId);
  // Mirrors the Contract ID input. Kept in sync with `contractId` so that
  // registering or clearing updates the field, not just the active id.
  const [contractInput, setContractInput] = useState(contractId);
  const [session, setSession] = useState<Session | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState(RESOURCES[0].id);
  const [summaries, setSummaries] = useState<Record<string, RatingSummary>>({});
  const [distributions, setDistributions] = useState<
    Record<string, RatingDistribution>
  >({});
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [reviewFilter, setReviewFilter] = useState<number | null>(null);
  // The (resource, filter) the current `reviews` belong to. When either
  // changes we clear the list during render so a tab/filter switch shows an
  // empty "loading" state instead of the previous selection's reviews while
  // the (slower) document query is in flight. React's documented
  // "adjust state during render" reset pattern.
  const reviewsKey = `${selectedResourceId}::${reviewFilter ?? "all"}`;
  const [reviewsKeyShown, setReviewsKeyShown] = useState(reviewsKey);
  if (reviewsKeyShown !== reviewsKey) {
    setReviewsKeyShown(reviewsKey);
    setReviews([]);
  }
  // DPNS names by identity ID, resolved lazily and cached across resources
  // (a reviewer's name doesn't change). `null` = looked up, none registered.
  const [dpnsNames, setDpnsNames] = useState<Record<string, string | null>>({});
  const [myReviews, setMyReviews] = useState<ReviewRecord[]>([]);
  const [myReviewsLoading, setMyReviewsLoading] = useState(false);
  const [mySelectedReview, setMySelectedReview] = useState<ReviewRecord | null>(
    null,
  );
  const [history, setHistory] = useState<ReviewHistoryEntry[]>([]);
  const [view, setView] = useState<View>("resources");
  const [mnemonic, setMnemonic] = useState("");
  const [identityIndex, setIdentityIndex] = useState("0");
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingRatings, setLoadingRatings] = useState(false);

  const selectedResource = useMemo(
    () =>
      RESOURCES.find((resource) => resource.id === selectedResourceId) ??
      RESOURCES[0],
    [selectedResourceId],
  );

  const log = useCallback((message: string, level: LogLevel = "info") => {
    consoleLogger(message, level);
    if (level !== "info") setStatus(message);
  }, []);

  const connectReadOnly = useCallback(async (): Promise<DashSdk> => {
    const { createClient } = await loadSdkCore();
    return (await createClient("testnet")) as unknown as DashSdk;
  }, []);

  const fetchMyReviews = useCallback(
    async (activeSession: Session): Promise<ReviewRecord[]> => {
      if (!contractId) return [];
      return listMyReviews({
        sdk: activeSession.sdk,
        contractId,
        ownerId: activeSession.identityId,
        log,
      });
    },
    [contractId, log],
  );

  const loadResourceData = useCallback(
    async (sdk?: DashSdk) => {
      if (!contractId) {
        setSummaries(
          Object.fromEntries(
            RESOURCES.map((resource) => [
              resource.id,
              emptySummary(resource.id),
            ]),
          ),
        );
        setDistributions(
          Object.fromEntries(
            RESOURCES.map((resource) => [resource.id, emptyDistribution()]),
          ),
        );
        setReviews([]);
        setMySelectedReview(null);
        return;
      }

      const activeSdk = sdk ?? session?.sdk ?? (await connectReadOnly());
      const perResource = await Promise.all(
        RESOURCES.map(async (resource) => {
          // Two count patterns per resource: a plain total count() and a
          // grouped count() for the distribution. The summary (average +
          // total) is derived from the distribution; the plain count is a
          // cross-check and a basic-countable-index demonstration.
          const [totalCount, distribution] = await Promise.all([
            getRatingCount({
              sdk: activeSdk,
              contractId,
              resourceId: resource.id,
              log,
            }),
            getRatingDistribution({
              sdk: activeSdk,
              contractId,
              resourceId: resource.id,
              log,
            }),
          ]);
          const summary = summaryFromDistribution(resource.id, distribution);
          return {
            resourceId: resource.id,
            summary: { ...summary, count: totalCount },
            distribution,
          };
        }),
      );
      setSummaries(
        Object.fromEntries(
          perResource.map(({ resourceId, summary }) => [resourceId, summary]),
        ),
      );
      setDistributions(
        Object.fromEntries(
          perResource.map(({ resourceId, distribution }) => [
            resourceId,
            distribution,
          ]),
        ),
      );

      // The reviews list itself is owned by the dedicated reviews effect
      // (keyed on resource + filter) so it's fetched once per
      // (resource, filter) and clearing the filter re-fetches the full
      // list. Bulk load only handles the per-resource aggregates here.

      if (session) {
        const mine = await findMyReviewForResource({
          sdk: activeSdk,
          contractId,
          resourceId: selectedResourceId,
          ownerId: session.identityId,
          log,
        });
        setMySelectedReview(mine);
        setRating(mine?.rating ?? null);
        setHoverRating(null);
        setReviewText(mine?.reviewText ?? "");
      }
    },
    [connectReadOnly, contractId, log, selectedResourceId, session],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingRatings(Boolean(contractId));
      try {
        await loadResourceData();
        if (!cancelled) setStatus("");
      } catch (err) {
        if (!cancelled) setStatus(`Load failed: ${errorMessage(err)}`);
      } finally {
        if (!cancelled) setLoadingRatings(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contractId, loadResourceData]);

  // Owns the recent-reviews list: (re)fetches it for the current resource
  // and rating filter. Runs on resource change, filter set, AND filter
  // clear (reviewFilter back to null) so clearing restores the full list.
  useEffect(() => {
    // No contract → loadResourceData already cleared the list to [].
    if (!contractId) return;
    let cancelled = false;
    (async () => {
      try {
        const activeSdk = session?.sdk ?? (await connectReadOnly());
        const list = await listResourceReviews({
          sdk: activeSdk,
          contractId,
          resourceId: selectedResourceId,
          ratingFilter: reviewFilter ?? undefined,
          log,
        });
        if (!cancelled) setReviews(list);
      } catch (err) {
        if (!cancelled) setStatus(`Reviews failed: ${errorMessage(err)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    connectReadOnly,
    contractId,
    log,
    reviewFilter,
    selectedResourceId,
    session,
  ]);

  // Resolve DPNS names for the identities currently on screen (review
  // authors, my-review owners, the signed-in user). Lazy: the lists render
  // with short IDs first and names swap in as they arrive. Only distinct,
  // not-yet-cached owners are looked up, in parallel, so revisiting a
  // resource costs nothing and a feed of N rows by M reviewers is M calls.
  useEffect(() => {
    const candidates = new Set<string>();
    for (const review of reviews) candidates.add(review.ownerId);
    for (const review of myReviews) candidates.add(review.ownerId);
    if (session) candidates.add(session.identityId);
    const pending = [...candidates].filter((id) => id && !(id in dpnsNames));
    if (pending.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const activeSdk = session?.sdk ?? (await connectReadOnly());
        const resolved = await Promise.all(
          pending.map(
            async (id) => [id, await resolveDpnsName(activeSdk, id)] as const,
          ),
        );
        if (!cancelled) {
          setDpnsNames((prev) => ({
            ...prev,
            ...Object.fromEntries(resolved),
          }));
        }
      } catch {
        // Name resolution is best-effort; the UI falls back to short IDs.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connectReadOnly, dpnsNames, myReviews, reviews, session]);

  useEffect(() => {
    if (!session || !contractId) return;
    if (view !== "my-reviews") return;
    let cancelled = false;
    (async () => {
      setMyReviewsLoading(true);
      try {
        const fetched = await fetchMyReviews(session);
        if (!cancelled) setMyReviews(fetched);
      } catch (err) {
        if (!cancelled) log(`My reviews failed: ${errorMessage(err)}`, "error");
      } finally {
        if (!cancelled) setMyReviewsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contractId, fetchMyReviews, log, session, view]);

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("Connecting...");
    try {
      const { createClient, IdentityKeyManager } = await loadSdkCore();
      const sdk = (await createClient("testnet")) as unknown as DashSdk;
      const keyManager = (await IdentityKeyManager.create({
        sdk: sdk as never,
        mnemonic: mnemonic.trim(),
        network: "testnet",
        identityIndex: Number(identityIndex) || 0,
      })) as unknown as DashKeyManager;
      const identityId = String(keyManager.identityId ?? "");
      if (!identityId) throw new Error("No identity found for this mnemonic.");
      setSession({ sdk, keyManager, identityId });
      setMnemonic("");
      setStatus("");
    } catch (err) {
      setStatus(`Sign-in failed: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveReview(event: React.FormEvent) {
    event.preventDefault();
    if (!session) {
      setStatus("Sign in before saving a review.");
      return;
    }
    if (!contractId) {
      setStatus("Register or paste a DashRate contract ID first.");
      return;
    }
    if (rating === null) {
      setStatus("Choose a star rating before saving your review.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      await saveReview({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId,
        resourceId: selectedResource.id,
        rating,
        reviewText,
        log,
      });
      await loadResourceData(session.sdk);
      setMyReviews(await fetchMyReviews(session));
      setStatus("");
    } catch (err) {
      setStatus(`Save failed: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleRegisterContract() {
    if (!session) {
      setStatus("Sign in before registering a contract.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const id = await registerContract({
        sdk: session.sdk,
        keyManager: session.keyManager,
        log,
      });
      setContractId(id);
      setContractInput(id);
      setStatus(`Registered new contract: ${id}`);
    } catch (err) {
      setStatus(`Registration failed: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleLoadHistory(reviewId: string) {
    if (!session || !contractId) return;
    setBusy(true);
    setStatus("Loading review history...");
    try {
      const entries = await fetchReviewHistory({
        sdk: session.sdk,
        contractId,
        reviewId,
      });
      setHistory(entries);
      setStatus("");
    } catch (err) {
      setStatus(`History failed: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  function handleContractSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextId = contractInput.trim();
    if (!nextId) return;
    saveContractId(nextId);
    setContractId(nextId);
    setContractInput(nextId);
    setMyReviews([]);
  }

  function clearContract() {
    clearStoredContractId();
    setContractId("");
    setContractInput("");
    setHistory([]);
    setMyReviews([]);
    setMySelectedReview(null);
  }

  function signOut() {
    setSession(null);
    setMyReviews([]);
    setMySelectedReview(null);
    setHistory([]);
  }

  function handleEditMyReview(review: ReviewRecord) {
    setSelectedResourceId(review.resourceId);
    setReviewFilter(null);
    setMySelectedReview(review);
    setRating(review.rating);
    setHoverRating(null);
    setReviewText(review.reviewText);
    setHistory([]);
    setView("resources");
  }

  const selectedSummary =
    summaries[selectedResource.id] ?? emptySummary(selectedResource.id);
  const selectedDistribution =
    distributions[selectedResource.id] ?? emptyDistribution();
  const distributionMax = RATING_ROWS.reduce<bigint>((max, value) => {
    const count = selectedDistribution[value] ?? 0n;
    return count > max ? count : max;
  }, 0n);
  const displayRating = hoverRating ?? rating ?? 0;
  const myReviewsAverage =
    myReviews.length === 0
      ? null
      : myReviews.reduce((total, review) => total + review.rating, 0) /
        myReviews.length;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">D</span>
          <h1>DashRate</h1>
        </div>
        <nav aria-label="Primary navigation">
          <button
            className={view === "resources" ? "active" : ""}
            aria-current={view === "resources" ? "page" : undefined}
            onClick={() => setView("resources")}
          >
            Resources
          </button>
          <button
            className={view === "my-reviews" ? "active" : ""}
            aria-current={view === "my-reviews" ? "page" : undefined}
            onClick={() => setView("my-reviews")}
          >
            My reviews
          </button>
          <button
            className={view === "settings" ? "active" : ""}
            aria-current={view === "settings" ? "page" : undefined}
            onClick={() => setView("settings")}
          >
            Settings
          </button>
          <button
            className={view === "how" ? "active" : ""}
            aria-current={view === "how" ? "page" : undefined}
            onClick={() => setView("how")}
          >
            How it works
          </button>
        </nav>
      </header>

      {status && <p className="status">{status}</p>}
      {!contractId && (
        <p className="notice">
          No default contract is bundled yet. Sign in and register a DashRate
          contract, or paste an existing contract ID in Settings.
        </p>
      )}

      {view === "resources" && (
        <section className="workspace">
          <aside className="resource-list" aria-label="Tutorial resources">
            {RESOURCES.map((resource) => {
              const summary =
                summaries[resource.id] ?? emptySummary(resource.id);
              return (
                <button
                  key={resource.id}
                  className={
                    resource.id === selectedResource.id
                      ? "resource-card selected"
                      : "resource-card"
                  }
                  onClick={() => {
                    setSelectedResourceId(resource.id);
                    setReviewFilter(null);
                    setHistory([]);
                  }}
                >
                  <span className="resource-category">{resource.category}</span>
                  <strong>{resource.title}</strong>
                  <small
                    className={
                      summary.count === 0n ? "rating-empty" : "rating-present"
                    }
                  >
                    {summary.count > 0n && (
                      <StarMeter
                        className="mini-stars"
                        value={summary.average}
                      />
                    )}
                    {reviewCountLine(summary)}
                  </small>
                </button>
              );
            })}
          </aside>

          <section className="detail">
            <div className="detail-head">
              <p className="eyebrow">{selectedResource.category}</p>
              <div className="detail-title-row">
                <h2>{selectedResource.title}</h2>
                <div className="detail-actions">
                  <a
                    className="resource-open"
                    href={selectedResource.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open ↗
                  </a>
                </div>
              </div>
              <div
                className="detail-rating"
                aria-label="Aggregate rating stats"
              >
                <strong className="detail-rating-score">
                  {selectedSummary.average === null
                    ? "—"
                    : formatAverage(selectedSummary.average)}
                </strong>
                <StarMeter
                  className="detail-rating-stars"
                  value={selectedSummary.average}
                />
                <span className="detail-rating-count muted">
                  {reviewCountLine(selectedSummary)}
                </span>
              </div>
              {selectedSummary.count > 0n && (
                <ul
                  className="rating-histogram"
                  aria-label="Rating distribution"
                >
                  {RATING_ROWS.map((value) => {
                    const count = selectedDistribution[value] ?? 0n;
                    const widthPercent =
                      distributionMax > 0n
                        ? Number((count * 100n) / distributionMax)
                        : 0;
                    const active = reviewFilter === value;
                    return (
                      <li key={value}>
                        <button
                          type="button"
                          className={
                            active ? "histogram-row active" : "histogram-row"
                          }
                          aria-pressed={active}
                          onClick={() => setReviewFilter(active ? null : value)}
                        >
                          <span className="histogram-label">{value}★</span>
                          <span className="histogram-track" aria-hidden="true">
                            <span
                              className="histogram-bar"
                              style={{ width: `${widthPercent}%` }}
                            />
                          </span>
                          <span className="histogram-count">
                            {count.toString()}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p>{selectedResource.summary}</p>

            <form
              className="resource-section review-form"
              onSubmit={handleSaveReview}
            >
              <h3>Your review</h3>
              {!session ? (
                <div className="signin-cta">
                  <p>Sign in to review this resource</p>
                  <button
                    type="button"
                    className="signin-cta-button"
                    onClick={() => setView("settings")}
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
                      onMouseLeave={() => setHoverRating(null)}
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={
                            value <= displayRating ? "star active" : "star"
                          }
                          role="radio"
                          aria-checked={rating === value}
                          aria-label={`${value} star${value === 1 ? "" : "s"}`}
                          onMouseEnter={() => setHoverRating(value)}
                          onFocus={() => setHoverRating(value)}
                          onBlur={() => setHoverRating(null)}
                          onClick={() => setRating(value)}
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
                      onChange={(event) => setReviewText(event.target.value)}
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
                    {mySelectedReview && (
                      <button
                        type="button"
                        onClick={() => handleLoadHistory(mySelectedReview.id)}
                        disabled={busy}
                      >
                        View history
                      </button>
                    )}
                  </div>
                </>
              )}
            </form>

            {history.length > 0 && (
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
            )}

            <section className="resource-section">
              <div className="review-list-head">
                <h3>
                  {reviewFilter == null
                    ? "Recent reviews"
                    : `${reviewFilter}★ reviews`}
                </h3>
                {reviewFilter != null && (
                  <button
                    type="button"
                    className="filter-clear"
                    onClick={() => setReviewFilter(null)}
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
          </section>
        </section>
      )}

      {view === "my-reviews" && (
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
                <MyReviewCard
                  key={review.id}
                  review={review}
                  onEdit={handleEditMyReview}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {view === "settings" && (
        <section className="panel settings">
          <h2>Settings</h2>
          <form onSubmit={handleSignIn}>
            <h3>Mnemonic login</h3>
            {session ? (
              <div>
                <p>
                  Identity:{" "}
                  {dpnsNames[session.identityId] ? (
                    <>
                      <strong>{dpnsNames[session.identityId]}</strong>{" "}
                      <code>{shortId(session.identityId)}</code>
                    </>
                  ) : (
                    <code>{shortId(session.identityId)}</code>
                  )}
                </p>
                <button type="button" onClick={signOut} disabled={busy}>
                  Sign out
                </button>
              </div>
            ) : (
              <>
                <label>
                  Mnemonic
                  <textarea
                    value={mnemonic}
                    onChange={(event) => setMnemonic(event.target.value)}
                    rows={3}
                    disabled={busy}
                  />
                </label>
                <label>
                  Identity index
                  <input
                    value={identityIndex}
                    onChange={(event) => setIdentityIndex(event.target.value)}
                    inputMode="numeric"
                    disabled={busy}
                  />
                </label>
                <button type="submit" disabled={busy || !mnemonic.trim()}>
                  Sign in
                </button>
              </>
            )}
          </form>

          <form onSubmit={handleContractSubmit}>
            <h3>Contract</h3>
            <p>
              Current: <code>{contractId || "none"}</code>
            </p>
            <label>
              Contract ID
              <input
                name="contractId"
                value={contractInput}
                onChange={(event) => setContractInput(event.target.value)}
              />
            </label>
            <div className="row">
              <button type="submit">Use contract</button>
              <button type="button" onClick={clearContract}>
                Clear
              </button>
              <button
                type="button"
                onClick={handleRegisterContract}
                disabled={busy || !session}
              >
                Register new
              </button>
            </div>
          </form>
        </section>
      )}

      {view === "how" && (
        <section className="panel">
          <h2>How it works</h2>
          <p>
            DashRate stores one mutable <code>review</code> document per
            identity and resource. The unique <code>$ownerId + resourceId</code>
            index prevents duplicate reviews by the same identity, so saving
            again edits the existing document instead of creating a second one.
          </p>
          <ul>
            <li>
              <code>documents.query</code> loads recent reviews by{" "}
              <code>resourceId</code>, My reviews by <code>$ownerId</code>, and
              the current user's review by <code>$ownerId + resourceId</code>.
              Adding a <code>rating == N</code> clause filters the list to a
              single star value — covered by the{" "}
              <code>[resourceId, rating]</code> index.
            </li>
            <li>
              <code>documents.count</code> on the countable{" "}
              <code>resourceId</code> index returns a resource's total review
              count — the basic count pattern.
            </li>
            <li>
              <code>documents.count</code> with <code>groupBy: ["rating"]</code>{" "}
              returns one count per star value — the rating distribution shown
              as bars. The <code>rating between [1, 5]</code> range over the
              countable <code>[resourceId, rating]</code> index drives the
              grouped walk. The average is computed from these per-star counts,
              so no separate <code>sum</code> / <code>average</code> query is
              needed.
            </li>
            <li>
              <code>documents.history</code> shows how a user's review changed
              across revisions because the document type keeps history.
            </li>
          </ul>
        </section>
      )}
    </main>
  );
}

function MyReviewCard({
  review,
  onEdit,
}: {
  review: ReviewRecord;
  onEdit: (review: ReviewRecord) => void;
}) {
  const resource = RESOURCES.find((item) => item.id === review.resourceId);
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

function ReviewRow({
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
