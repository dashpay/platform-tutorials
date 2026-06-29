// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ReviewRow } from "../src/components/ReviewRow";
import type { ReviewRecord } from "../src/dash/queries";

afterEach(() => {
  cleanup();
});

function makeReview(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: "review-1",
    ownerId: "owner-1",
    resourceId: "tokens",
    rating: 4,
    reviewText: "Solid walkthrough",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_100_000,
    revision: 1,
    ...overrides,
  };
}

describe("ReviewRow", () => {
  it("shows the owner name, star string, and review text", () => {
    const { container } = render(
      <ReviewRow review={makeReview()} ownerName="alice" />,
    );
    expect(screen.getByText("alice")).toBeTruthy();
    expect(screen.getByText("Solid walkthrough")).toBeTruthy();
    // rating 4 → four filled, one empty star.
    expect(screen.getByText("★★★★☆")).toBeTruthy();
    expect(container.querySelector("time")).not.toBeNull();
  });

  it("falls back to a placeholder when there is no written review", () => {
    render(
      <ReviewRow review={makeReview({ reviewText: "" })} ownerName="bob" />,
    );
    expect(screen.getByText("No written review.")).toBeTruthy();
  });
});
