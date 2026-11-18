// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecentReviews } from "../src/components/RecentReviews";
import type { ReviewRecord } from "../src/dash/queries";

afterEach(() => {
  cleanup();
});

type Props = Parameters<typeof RecentReviews>[0];

function makeReview(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: "review-1",
    ownerId: "owner-1",
    resourceId: "tokens",
    rating: 4,
    reviewText: "Nice",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_100_000,
    revision: 1,
    ...overrides,
  };
}

function renderList(overrides: Partial<Props> = {}) {
  const props: Props = {
    reviews: [],
    hasMore: false,
    loadingMore: false,
    onLoadMore: vi.fn(),
    reviewFilter: null,
    loadingRatings: false,
    dpnsNames: {},
    onClearFilter: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<RecentReviews {...props} />) };
}

describe("RecentReviews", () => {
  it("shows a loading status while ratings load and the list is empty", () => {
    renderList({ loadingRatings: true });
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Loading reviews");
  });

  it("shows the generic empty message with no filter", () => {
    renderList();
    expect(screen.getByText("No reviews yet.")).toBeTruthy();
    expect(screen.getByText("Recent reviews")).toBeTruthy();
  });

  it("shows a filter-scoped heading and empty message when filtered", () => {
    renderList({ reviewFilter: 3 });
    expect(screen.getByText("3★ reviews")).toBeTruthy();
    expect(screen.getByText("No 3★ reviews yet.")).toBeTruthy();
  });

  it("renders one row per review and labels owners via dpnsNames", () => {
    const { container } = renderList({
      reviews: [
        makeReview({ id: "a" }),
        makeReview({ id: "b", ownerId: "owner-2" }),
      ],
      dpnsNames: { "owner-1": "alice" },
    });
    expect(container.querySelectorAll(".review-row")).toHaveLength(2);
    // owner-1 resolves to a DPNS name; owner-2 falls back to a short id.
    expect(screen.getByText("alice")).toBeTruthy();
  });

  it("shows Clear filter only when a filter is set", () => {
    const onClearFilter = vi.fn();
    const { rerender } = render(
      <RecentReviews
        reviews={[]}
        hasMore={false}
        loadingMore={false}
        onLoadMore={() => {}}
        reviewFilter={null}
        loadingRatings={false}
        dpnsNames={{}}
        onClearFilter={onClearFilter}
      />,
    );
    expect(screen.queryByRole("button", { name: /clear filter/i })).toBeNull();

    rerender(
      <RecentReviews
        reviews={[]}
        hasMore={false}
        loadingMore={false}
        onLoadMore={() => {}}
        reviewFilter={2}
        loadingRatings={false}
        dpnsNames={{}}
        onClearFilter={onClearFilter}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /clear filter/i }));
    expect(onClearFilter).toHaveBeenCalledOnce();
  });

  it("offers Load more only while another page exists", () => {
    const onLoadMore = vi.fn();
    const { rerender } = renderList({
      reviews: [makeReview()],
      hasMore: true,
      onLoadMore,
    });
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(onLoadMore).toHaveBeenCalledOnce();

    rerender(
      <RecentReviews
        reviews={[makeReview()]}
        hasMore={true}
        loadingMore={true}
        onLoadMore={onLoadMore}
        reviewFilter={null}
        loadingRatings={false}
        dpnsNames={{}}
        onClearFilter={() => {}}
      />,
    );
    const busy = screen.getByRole("button", { name: "Loading…" });
    expect((busy as HTMLButtonElement).disabled).toBe(true);

    rerender(
      <RecentReviews
        reviews={[makeReview()]}
        hasMore={false}
        loadingMore={false}
        onLoadMore={onLoadMore}
        reviewFilter={null}
        loadingRatings={false}
        dpnsNames={{}}
        onClearFilter={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: /load more/i })).toBeNull();
  });
});
