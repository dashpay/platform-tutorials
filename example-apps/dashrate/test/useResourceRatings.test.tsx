// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RESOURCES } from "../src/catalog/resources";
import type {
  RatingDistribution,
  RatingSummary,
  ReviewPage,
  ReviewRecord,
} from "../src/dash/queries";
import type { DashSdk } from "../src/dash/types";
import type { Session } from "../src/session/types";

const getRatingSummary = vi.fn();
const getRatingDistribution = vi.fn();
const listResourceReviews = vi.fn();
const findMyReviewForResource = vi.fn();

vi.mock("../src/dash/queries", () => ({
  getRatingSummary,
  getRatingDistribution,
  listResourceReviews,
  findMyReviewForResource,
}));

const { useResourceRatings } = await import("../src/hooks/useResourceRatings");

const fakeSdk = { tag: "fake" } as unknown as DashSdk;

function distribution(): RatingDistribution {
  return { 1: 0n, 2: 0n, 3: 0n, 4: 1n, 5: 0n };
}

function summary(resourceId: string, count = 1n): RatingSummary {
  return { resourceId, count, sum: 4n * count, average: 4 };
}

function page(
  reviews: ReviewRecord[],
  nextCursor: string | null = null,
): ReviewPage {
  return { reviews, nextCursor };
}

function review(id: string): ReviewRecord {
  return {
    id,
    ownerId: "owner-1",
    resourceId: "tokens",
    rating: 4,
    reviewText: "",
    createdAt: 1,
    updatedAt: 2,
    revision: 1,
  };
}

function makeArgs(
  overrides: Partial<Parameters<typeof useResourceRatings>[0]> = {},
) {
  return {
    contractId: "c1",
    session: null as Session | null,
    selectedResourceId: "tokens",
    refreshToken: 0,
    connectReadOnly: vi.fn().mockResolvedValue(fakeSdk),
    log: vi.fn(),
    setStatus: vi.fn(),
    ...overrides,
  };
}

/** A promise whose resolution is controlled externally, for ordering tests. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  getRatingSummary.mockImplementation(
    async ({ resourceId }: { resourceId: string }) => summary(resourceId),
  );
  getRatingDistribution.mockResolvedValue(distribution());
  listResourceReviews.mockResolvedValue(page([]));
  findMyReviewForResource.mockResolvedValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe("useResourceRatings initial load", () => {
  it("loads summaries for every resource", async () => {
    const args = makeArgs();
    const { result } = renderHook((props) => useResourceRatings(props), {
      initialProps: args,
    });

    await waitFor(() => {
      expect(Object.keys(result.current.summaries)).toHaveLength(
        RESOURCES.length,
      );
    });
    expect(result.current.loadingRatings).toBe(false);
    // Nothing went wrong, so the status line is left alone.
    expect(args.setStatus).not.toHaveBeenCalled();
    // One average + distribution per resource.
    expect(getRatingSummary).toHaveBeenCalledTimes(RESOURCES.length);
    expect(getRatingDistribution).toHaveBeenCalledTimes(RESOURCES.length);
    expect(result.current.summaries.tokens).toEqual(summary("tokens"));
  });

  it("resets to empty summaries and runs no queries without a contract", async () => {
    const args = makeArgs({ contractId: "" });
    const { result } = renderHook((props) => useResourceRatings(props), {
      initialProps: args,
    });

    await waitFor(() => {
      expect(Object.keys(result.current.summaries)).toHaveLength(
        RESOURCES.length,
      );
    });
    expect(result.current.summaries.tokens.count).toBe(0n);
    expect(getRatingSummary).not.toHaveBeenCalled();
  });

  it("populates the composer from the signed-in user's existing review", async () => {
    findMyReviewForResource.mockResolvedValue({
      ...review("mine"),
      rating: 5,
      reviewText: "loved it",
    });
    const session = {
      sdk: fakeSdk,
      identityId: "owner-1",
    } as unknown as Session;
    const { result } = renderHook((props) => useResourceRatings(props), {
      initialProps: makeArgs({ session }),
    });
    await waitFor(() => {
      expect(result.current.mySelectedReview?.id).toBe("mine");
    });
    expect(result.current.rating).toBe(5);
    expect(result.current.reviewText).toBe("loved it");
  });
});

describe("useResourceRatings partial failures", () => {
  it("keeps the other resources when one average fails", async () => {
    // e.g. a testnet node answering "Operation is not implemented".
    getRatingSummary.mockImplementation(
      async ({ resourceId }: { resourceId: string }) => {
        if (resourceId === "identities-names") throw new Error("unsupported");
        return summary(resourceId);
      },
    );
    const args = makeArgs();
    const { result, rerender } = renderHook(
      (props) => useResourceRatings(props),
      { initialProps: args },
    );

    await waitFor(() => expect(result.current.loadingRatings).toBe(false));
    expect(result.current.summaries.tokens).toEqual(summary("tokens"));
    expect(result.current.summaries.dashnote).toEqual(summary("dashnote"));
    expect(result.current.summaries["identities-names"]).toBeUndefined();
    expect(args.setStatus).not.toHaveBeenCalledWith(
      expect.stringContaining("Load failed"),
    );

    // A later load fills in the resource that failed, and doesn't wipe the
    // status line (it may hold an unrelated message, e.g. after a save).
    getRatingSummary.mockImplementation(
      async ({ resourceId }: { resourceId: string }) => summary(resourceId),
    );
    rerender({ ...args, refreshToken: 1 });
    await waitFor(() =>
      expect(result.current.summaries["identities-names"]).toBeDefined(),
    );
    expect(args.setStatus).not.toHaveBeenCalledWith("");
  });
});

describe("useResourceRatings refresh token", () => {
  it("reloads everything on a token bump alone (same selection)", async () => {
    // Save on tokens and stay there: the bump must re-read the list and
    // the viewer's review, or the new revision never shows.
    findMyReviewForResource.mockResolvedValue(null);
    listResourceReviews.mockResolvedValue(page([review("r1")]));
    const session = {
      sdk: fakeSdk,
      identityId: "owner-1",
    } as unknown as Session;
    const args = makeArgs({ session });
    const { result, rerender } = renderHook(
      (props) => useResourceRatings(props),
      { initialProps: args },
    );
    await waitFor(() => expect(result.current.reviews).toHaveLength(1));
    await waitFor(() => expect(result.current.loadingRatings).toBe(false));
    const listCalls = listResourceReviews.mock.calls.length;
    const mineCalls = findMyReviewForResource.mock.calls.length;

    listResourceReviews.mockResolvedValue(page([review("r2"), review("r1")]));
    rerender({ ...args, refreshToken: 1 });

    await waitFor(() =>
      expect(result.current.reviews.map((r) => r.id)).toEqual(["r2", "r1"]),
    );
    expect(listResourceReviews.mock.calls.length).toBe(listCalls + 1);
    await waitFor(() =>
      expect(findMyReviewForResource.mock.calls.length).toBe(mineCalls + 1),
    );
  });

  it("reloads for the CURRENT selection, never the one saved from", async () => {
    // Save on tokens → user switches to dashnote during the wait → the
    // token bump must load dashnote's review into the composer.
    findMyReviewForResource.mockImplementation(
      async ({ resourceId }: { resourceId: string }) => ({
        ...review(`mine-${resourceId}`),
        resourceId,
        reviewText: `about ${resourceId}`,
      }),
    );
    listResourceReviews.mockImplementation(
      async ({ resourceId }: { resourceId: string }) =>
        page([{ ...review(`r-${resourceId}`), resourceId }]),
    );
    const session = {
      sdk: fakeSdk,
      identityId: "owner-1",
    } as unknown as Session;
    const args = makeArgs({ session, selectedResourceId: "tokens" });
    const { result, rerender } = renderHook(
      (props) => useResourceRatings(props),
      { initialProps: args },
    );
    await waitFor(() =>
      expect(result.current.mySelectedReview?.id).toBe("mine-tokens"),
    );

    rerender({ ...args, selectedResourceId: "dashnote" });
    rerender({ ...args, selectedResourceId: "dashnote", refreshToken: 1 });

    await waitFor(() =>
      expect(result.current.mySelectedReview?.id).toBe("mine-dashnote"),
    );
    expect(result.current.reviewText).toBe("about dashnote");
    expect(result.current.reviews.map((r) => r.resourceId)).toEqual([
      "dashnote",
    ]);
    expect(findMyReviewForResource).toHaveBeenLastCalledWith(
      expect.objectContaining({ resourceId: "dashnote" }),
    );
  });
});

describe("useResourceRatings stale-response guards", () => {
  it("drops a ratings load that a newer one supersedes", async () => {
    const args = makeArgs();
    const { result, rerender } = renderHook(
      (props) => useResourceRatings(props),
      { initialProps: args },
    );
    await waitFor(() => expect(result.current.loadingRatings).toBe(false));

    // Load N stalls on its first summary; load N+1 completes; then N
    // resolves late. Its 99n must not overwrite N+1's 1n.
    const first = deferred<RatingSummary>();
    getRatingSummary.mockReturnValueOnce(first.promise);
    rerender({ ...args, refreshToken: 1 });
    rerender({ ...args, refreshToken: 2 });
    await waitFor(() => expect(result.current.loadingRatings).toBe(false));
    await act(async () => first.resolve(summary("intro", 99n)));

    expect(result.current.summaries.intro.count).toBe(1n);
  });

  it("drops a review list that a newer one supersedes", async () => {
    const args = makeArgs();
    const { result, rerender } = renderHook(
      (props) => useResourceRatings(props),
      { initialProps: args },
    );
    await waitFor(() => expect(result.current.loadingRatings).toBe(false));

    const staleList = deferred<ReviewPage>();
    listResourceReviews.mockReturnValueOnce(staleList.promise);
    rerender({ ...args, refreshToken: 1 });
    rerender({ ...args, refreshToken: 2 });
    await waitFor(() => expect(listResourceReviews).toHaveBeenCalledTimes(3));
    await act(async () => staleList.resolve(page([review("stale")])));

    // The fresh (empty) result wins; the stale single-review list is dropped.
    expect(result.current.reviews).toHaveLength(0);
  });
});

describe("useResourceRatings review paging", () => {
  it("appends the next page via startAfter and stops on the last", async () => {
    listResourceReviews.mockResolvedValueOnce(
      page([review("r1"), review("r2")], "r2"),
    );
    const { result } = renderHook((props) => useResourceRatings(props), {
      initialProps: makeArgs(),
    });
    await waitFor(() => expect(result.current.reviews).toHaveLength(2));
    expect(result.current.hasMoreReviews).toBe(true);

    // The next page repeats r2 (e.g. edited mid-paging); it's not duplicated.
    listResourceReviews.mockResolvedValueOnce(
      page([review("r2"), review("r3")]),
    );
    await act(async () => {
      await result.current.loadMoreReviews();
    });

    expect(listResourceReviews).toHaveBeenLastCalledWith(
      expect.objectContaining({ resourceId: "tokens", startAfter: "r2" }),
    );
    expect(result.current.reviews.map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
    expect(result.current.hasMoreReviews).toBe(false);
    expect(result.current.loadingMoreReviews).toBe(false);
  });

  it("keeps the rating filter when loading more", async () => {
    listResourceReviews.mockResolvedValue(page([review("r1")], "r1"));
    const { result } = renderHook((props) => useResourceRatings(props), {
      initialProps: makeArgs(),
    });
    act(() => result.current.setReviewFilter(4));
    await waitFor(() => expect(result.current.hasMoreReviews).toBe(true));

    await act(async () => {
      await result.current.loadMoreReviews();
    });
    expect(listResourceReviews).toHaveBeenLastCalledWith(
      expect.objectContaining({ ratingFilter: 4, startAfter: "r1" }),
    );
  });

  it("drops an in-flight page when the resource changes", async () => {
    const args = makeArgs();
    listResourceReviews.mockResolvedValueOnce(
      page([review("t1")], "t1"), // tokens, page 1
    );
    const { result, rerender } = renderHook(
      (props) => useResourceRatings(props),
      { initialProps: args },
    );
    await waitFor(() => expect(result.current.hasMoreReviews).toBe(true));

    const stalePage = deferred<ReviewPage>();
    listResourceReviews.mockReturnValueOnce(stalePage.promise); // tokens, page 2
    let loadMore!: Promise<void>;
    act(() => {
      loadMore = result.current.loadMoreReviews();
    });
    expect(result.current.loadingMoreReviews).toBe(true);

    listResourceReviews.mockResolvedValueOnce(page([review("d1")], "d1"));
    rerender({ ...args, selectedResourceId: "dashnote" });
    await waitFor(() =>
      expect(result.current.reviews.map((r) => r.id)).toEqual(["d1"]),
    );

    // dashnote's own Load more is now in flight.
    const freshPage = deferred<ReviewPage>();
    listResourceReviews.mockReturnValueOnce(freshPage.promise);
    let freshLoad!: Promise<void>;
    act(() => {
      freshLoad = result.current.loadMoreReviews();
    });

    await act(async () => {
      stalePage.resolve(page([review("t2")]));
      await loadMore;
    });
    // tokens' page 2 isn't appended to dashnote, and settling it doesn't
    // clear dashnote's in-flight flag.
    expect(result.current.reviews.map((r) => r.id)).toEqual(["d1"]);
    expect(result.current.loadingMoreReviews).toBe(true);

    await act(async () => {
      freshPage.resolve(page([review("d2")]));
      await freshLoad;
    });
    expect(result.current.reviews.map((r) => r.id)).toEqual(["d1", "d2"]);
    expect(result.current.loadingMoreReviews).toBe(false);
  });

  it("surfaces a status when loading more fails", async () => {
    const args = makeArgs();
    listResourceReviews.mockResolvedValueOnce(page([review("r1")], "r1"));
    const { result } = renderHook((props) => useResourceRatings(props), {
      initialProps: args,
    });
    await waitFor(() => expect(result.current.hasMoreReviews).toBe(true));

    listResourceReviews.mockRejectedValueOnce(new Error("offline"));
    await act(async () => {
      await result.current.loadMoreReviews();
    });
    expect(args.setStatus).toHaveBeenCalledWith("More reviews failed: offline");
    expect(result.current.reviews).toHaveLength(1);
  });
});

describe("useResourceRatings composer setters", () => {
  it("updates rating, review text, and filter", async () => {
    const { result } = renderHook((props) => useResourceRatings(props), {
      initialProps: makeArgs(),
    });
    await waitFor(() => expect(result.current.loadingRatings).toBe(false));

    act(() => result.current.setRating(3));
    act(() => result.current.setReviewText("hello"));
    act(() => result.current.setReviewFilter(5));

    expect(result.current.rating).toBe(3);
    expect(result.current.reviewText).toBe("hello");
    expect(result.current.reviewFilter).toBe(5);
  });
});
