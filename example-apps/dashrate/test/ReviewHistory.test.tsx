// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ReviewHistory } from "../src/components/ReviewHistory";
import type { ReviewHistoryEntry } from "../src/dash/history";

afterEach(() => {
  cleanup();
});

const entries: ReviewHistoryEntry[] = [
  {
    blockTimeMs: 1_700_000_100_000,
    revision: 2,
    rating: 4,
    reviewText: "Better now",
  },
  { blockTimeMs: 1_700_000_000_000, revision: 1, rating: 5, reviewText: "" },
];

describe("ReviewHistory", () => {
  it("renders nothing for an empty history", () => {
    const { container } = render(<ReviewHistory history={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one row per revision with rating and a text fallback", () => {
    const { container } = render(<ReviewHistory history={entries} />);
    expect(container.querySelectorAll(".review-row")).toHaveLength(2);
    expect(screen.getByText("Revision 2: 4 stars")).toBeTruthy();
    expect(screen.getByText("Revision 1: 5 stars")).toBeTruthy();
    expect(screen.getByText("Better now")).toBeTruthy();
    // Empty reviewText falls back to the placeholder.
    expect(screen.getByText("No review text.")).toBeTruthy();
  });
});
