// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReviewRecord } from "../src/dash/queries";
import type { Session } from "../src/session/types";

const listMyReviews = vi.fn();
vi.mock("../src/dash/queries", () => ({ listMyReviews }));

const { useMyReviews } = await import("../src/hooks/useMyReviews");

const session = { sdk: {}, identityId: "owner-1" } as unknown as Session;

function review(id: string, rating: number): ReviewRecord {
  return {
    id,
    ownerId: "owner-1",
    resourceId: "tokens",
    rating,
    reviewText: "",
    createdAt: 1,
    updatedAt: 2,
    revision: 1,
  };
}

beforeEach(() => {
  listMyReviews.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("useMyReviews", () => {
  it("does not fetch when disabled", () => {
    renderHook(() =>
      useMyReviews({ contractId: "c1", enabled: false, session, log: vi.fn() }),
    );
    expect(listMyReviews).not.toHaveBeenCalled();
  });

  it("does not fetch without a session or contract", () => {
    renderHook(() =>
      useMyReviews({
        contractId: "c1",
        enabled: true,
        session: null,
        log: vi.fn(),
      }),
    );
    renderHook(() =>
      useMyReviews({ contractId: "", enabled: true, session, log: vi.fn() }),
    );
    expect(listMyReviews).not.toHaveBeenCalled();
  });

  it("fetches on mount and derives the average", async () => {
    listMyReviews.mockResolvedValue([review("a", 4), review("b", 2)]);
    const { result } = renderHook(() =>
      useMyReviews({ contractId: "c1", enabled: true, session, log: vi.fn() }),
    );

    await waitFor(() => {
      expect(result.current.myReviews).toHaveLength(2);
    });
    expect(result.current.myReviewsLoading).toBe(false);
    expect(result.current.myReviewsAverage).toBe(3);
  });

  it("reports a null average with no reviews", async () => {
    listMyReviews.mockResolvedValue([]);
    const { result } = renderHook(() =>
      useMyReviews({ contractId: "c1", enabled: true, session, log: vi.fn() }),
    );
    await waitFor(() => expect(result.current.myReviewsLoading).toBe(false));
    expect(result.current.myReviewsAverage).toBeNull();
  });

  it("logs an error and does not throw when the fetch fails", async () => {
    const log = vi.fn();
    listMyReviews.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() =>
      useMyReviews({ contractId: "c1", enabled: true, session, log }),
    );
    await waitFor(() => {
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("My reviews failed"),
        "error",
      );
    });
    expect(result.current.myReviews).toHaveLength(0);
  });

  it("refreshMyReviews fetches and stores the list", async () => {
    listMyReviews.mockResolvedValue([review("a", 5)]);
    const { result } = renderHook(() =>
      useMyReviews({ contractId: "c1", enabled: false, session, log: vi.fn() }),
    );

    let returned: ReviewRecord[] = [];
    await act(async () => {
      returned = await result.current.refreshMyReviews();
    });
    expect(returned).toHaveLength(1);
    expect(result.current.myReviews).toHaveLength(1);
  });

  it("setMyReviews clears the list", async () => {
    listMyReviews.mockResolvedValue([review("a", 5)]);
    const { result } = renderHook(() =>
      useMyReviews({ contractId: "c1", enabled: true, session, log: vi.fn() }),
    );
    await waitFor(() => expect(result.current.myReviews).toHaveLength(1));
    act(() => result.current.setMyReviews([]));
    expect(result.current.myReviews).toHaveLength(0);
  });
});
