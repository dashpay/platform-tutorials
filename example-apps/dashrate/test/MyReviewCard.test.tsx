// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MyReviewCard } from "../src/components/MyReviewCard";
import type { ReviewRecord } from "../src/dash/queries";

afterEach(() => {
  cleanup();
});

function makeReview(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: "review-1",
    ownerId: "owner-1",
    resourceId: "tokens",
    rating: 5,
    reviewText: "Loved it",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_100_000,
    revision: 1,
    ...overrides,
  };
}

describe("MyReviewCard", () => {
  it("resolves the catalog title and links to the resource", () => {
    render(<MyReviewCard review={makeReview()} onEdit={() => {}} />);
    // resourceId "tokens" resolves to the "Tokens" catalog entry.
    expect(screen.getByText("Tokens")).toBeTruthy();
    expect(screen.getByText("Tutorial")).toBeTruthy();
    const link = screen.getByRole("link", { name: /open resource/i });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("falls back to the raw resourceId and hides the link for unknown resources", () => {
    render(
      <MyReviewCard
        review={makeReview({ resourceId: "mystery-resource" })}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText("mystery-resource")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /open resource/i })).toBeNull();
  });

  it("invokes onEdit with the review when Edit is clicked", () => {
    const onEdit = vi.fn();
    const review = makeReview();
    render(<MyReviewCard review={review} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: /edit review/i }));
    expect(onEdit).toHaveBeenCalledWith(review);
  });
});
