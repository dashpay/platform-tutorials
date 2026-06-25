// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReviewRecord } from "../src/dash/queries";
import type { Session } from "../src/session/types";

const onEditSpy = vi.fn();

// Stub MyReviewCard so the test targets the view shell's branching and can
// count cards + verify the onEdit wiring without rendering the real card.
vi.mock("../src/components/MyReviewCard", () => ({
  MyReviewCard: ({
    review,
    onEdit,
  }: {
    review: ReviewRecord;
    onEdit: (review: ReviewRecord) => void;
  }) => (
    <button
      type="button"
      data-testid="my-review-card"
      onClick={() => onEdit(review)}
    >
      {review.id}
    </button>
  ),
}));

const { MyReviewsView } = await import("../src/components/MyReviewsView");

const session = { identityId: "owner-1" } as unknown as Session;

function makeReview(id: string, rating: number): ReviewRecord {
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

type Props = Parameters<typeof MyReviewsView>[0];

function renderView(overrides: Partial<Props> = {}) {
  const props: Props = {
    session,
    dpnsNames: {},
    myReviews: [],
    myReviewsLoading: false,
    myReviewsAverage: null,
    onEdit: onEditSpy,
    ...overrides,
  };
  return { props, ...render(<MyReviewsView {...props} />) };
}

beforeEach(() => {
  onEditSpy.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("MyReviewsView", () => {
  it("prompts to sign in when there is no session", () => {
    renderView({ session: null });
    expect(
      screen.getByText("Sign in to see reviews written by your identity."),
    ).toBeTruthy();
  });

  it("shows a loading message while fetching", () => {
    renderView({ myReviewsLoading: true });
    expect(screen.getByText("Loading your reviews...")).toBeTruthy();
  });

  it("shows the empty message when the identity has no reviews", () => {
    renderView({ myReviews: [] });
    expect(screen.getByText("No reviews from this identity yet.")).toBeTruthy();
  });

  it("renders a card per review with the count and average summary", () => {
    renderView({
      myReviews: [makeReview("a", 4), makeReview("b", 2)],
      myReviewsAverage: 3,
    });
    expect(screen.getAllByTestId("my-review-card")).toHaveLength(2);
    expect(screen.getByText(/2 reviews/)).toBeTruthy();
    // Average renders via formatAverage (one decimal).
    expect(screen.getByText("3.0")).toBeTruthy();
  });

  it("passes the clicked review through onEdit", () => {
    const first = makeReview("a", 5);
    const second = makeReview("b", 3);
    renderView({ myReviews: [first, second] });
    // Click the second card to prove the right review object is wired
    // through, not just that some review reaches onEdit.
    fireEvent.click(screen.getAllByTestId("my-review-card")[1]);
    expect(onEditSpy).toHaveBeenCalledOnce();
    expect(onEditSpy).toHaveBeenCalledWith(second);
  });
});
