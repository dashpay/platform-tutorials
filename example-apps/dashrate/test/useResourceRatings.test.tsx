// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RESOURCES } from "../src/catalog/resources";
import type {
  RatingDistribution,
  RatingSummary,
  ReviewRecord,
} from "../src/dash/queries";
import type { DashSdk } from "../src/dash/types";
import type { Session } from "../src/session/types";

const getRatingCount = vi.fn();
const getRatingDistribution = vi.fn();
const summaryFromDistribution = vi.fn();
const listResourceReviews = vi.fn();
const findMyReviewForResource = vi.fn();

vi.mock("../src/dash/queries", () => ({
  getRatingCount,
  getRatingDistribution,
  summaryFromDistribution,
  listResourceReviews,
  findMyReviewForResource,
}));

const { useResourceRatings } = await import("../src/hooks/useResourceRatings");

const fakeSdk = { tag: "fake" } as unknown as DashSdk;

function distribution(): RatingDistribution {
  return { 1: 0n, 2: 0n, 3: 0n, 4: 1n, 5: 0n };
}

function summary(resourceId: string): RatingSummary {
  return { resourceId, count: 1n, sum: 4n, average: 4 };
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
  getRatingCount.mockResolvedValue(1n);
  getRatingDistribution.mockResolvedValue(distribution());
  summaryFromDistribution.mockImplementation((resourceId: string) =>
    summary(resourceId),
  );
  listResourceReviews.mockResolvedValue([]);
  findMyReviewForResource.mockResolvedValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe("useResourceRatings initial load", () => {
  it("loads summaries for every resource and clears status on success", async () => {
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
    expect(args.setStatus).toHaveBeenCalledWith("");
    // One count + distribution per resource.
    expect(getRatingCount).toHaveBeenCalledTimes(RESOURCES.length);
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
    expect(getRatingCount).not.toHaveBeenCalled();
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

describe("useResourceRatings stale-response guards", () => {
  it("ignores a stale loadResourceData when a newer one supersedes it", async () => {
    const { result } = renderHook((props) => useResourceRatings(props), {
      initialProps: makeArgs(),
    });
    await waitFor(() => expect(result.current.loadingRatings).toBe(false));

    // First call resolves AFTER the second; its writes must be dropped.
    const first = deferred<bigint>();
    getRatingCount.mockReturnValueOnce(first.promise);

    await act(async () => {
      const stale = result.current.loadResourceData(fakeSdk); // request N
      const fresh = result.current.loadResourceData(fakeSdk); // request N+1
      first.resolve(99n); // late-resolve the stale call
      await Promise.all([stale, fresh]);
    });

    // The fresh request used the default 1n count, not the stale 99n.
    expect(result.current.summaries.tokens.count).toBe(1n);
  });

  it("ignores a stale refreshReviews when a newer one supersedes it", async () => {
    const { result } = renderHook((props) => useResourceRatings(props), {
      initialProps: makeArgs(),
    });
    await waitFor(() => expect(result.current.loadingRatings).toBe(false));

    const staleList = deferred<ReviewRecord[]>();
    listResourceReviews.mockReturnValueOnce(staleList.promise);

    await act(async () => {
      const stale = result.current.refreshReviews(fakeSdk); // request N
      const fresh = result.current.refreshReviews(fakeSdk); // request N+1
      staleList.resolve([review("stale")]);
      await Promise.all([stale, fresh]);
    });

    // The fresh (empty) result wins; the stale single-review list is dropped.
    expect(result.current.reviews).toHaveLength(0);
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
