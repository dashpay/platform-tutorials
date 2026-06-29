// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RESOURCES } from "../src/catalog/resources";
import type { RatingDistribution, RatingSummary } from "../src/dash/queries";

// Stub the heavy leaf children so the test targets the ResourcesView shell:
// the resource list, the detail head, and the histogram.
vi.mock("../src/components/ReviewForm", () => ({
  ReviewForm: () => <div data-testid="review-form" />,
}));
vi.mock("../src/components/RecentReviews", () => ({
  RecentReviews: () => <div data-testid="recent-reviews" />,
}));
vi.mock("../src/components/StarMeter", () => ({
  StarMeter: ({ value }: { value: number | null }) => (
    <span data-testid="star-meter">{String(value)}</span>
  ),
}));

const { ResourcesView } = await import("../src/components/ResourcesView");

type Props = Parameters<typeof ResourcesView>[0];

const tokens = RESOURCES.find((r) => r.id === "tokens")!;

function summary(overrides: Partial<RatingSummary> = {}): RatingSummary {
  return {
    resourceId: "tokens",
    count: 0n,
    sum: 0n,
    average: null,
    ...overrides,
  };
}

function distribution(
  overrides: Partial<RatingDistribution> = {},
): RatingDistribution {
  return { 1: 0n, 2: 0n, 3: 0n, 4: 0n, 5: 0n, ...overrides };
}

function renderView(overrides: Partial<Props> = {}) {
  const props: Props = {
    selectedResource: tokens,
    summaries: {},
    distributions: {},
    reviews: [],
    reviewFilter: null,
    loadingRatings: false,
    history: [],
    signedIn: false,
    busy: false,
    contractId: "c1",
    rating: null,
    hoverRating: null,
    reviewText: "",
    hasSelectedReview: false,
    dpnsNames: {},
    onSelectResource: vi.fn(),
    onReviewFilterChange: vi.fn(),
    onSaveReview: vi.fn(),
    onOpenSettings: vi.fn(),
    onRatingChange: vi.fn(),
    onHoverRatingChange: vi.fn(),
    onReviewTextChange: vi.fn(),
    onLoadHistory: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<ResourcesView {...props} />) };
}

beforeEach(() => {
  // handleSelectResource calls window.matchMedia; jsdom doesn't implement it.
  // Returning matches:false takes the desktop (no-scroll) branch.
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: false } as MediaQueryList),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("ResourcesView resource list", () => {
  it("renders one card per catalog resource and marks the selected one", () => {
    const { container } = renderView();
    expect(container.querySelectorAll(".resource-card")).toHaveLength(
      RESOURCES.length,
    );
    const selected = container.querySelectorAll(".resource-card.selected");
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toContain(tokens.title);
  });

  it("calls onSelectResource when a card is clicked", () => {
    const onSelectResource = vi.fn();
    const { container } = renderView({ onSelectResource });
    const cards =
      container.querySelectorAll<HTMLButtonElement>(".resource-card");
    fireEvent.click(cards[0]);
    expect(onSelectResource).toHaveBeenCalledWith(RESOURCES[0].id);
  });
});

describe("ResourcesView detail head", () => {
  it("shows the resource metadata and an em dash when there is no average", () => {
    renderView();
    expect(screen.getByRole("heading", { name: tokens.title })).toBeTruthy();
    expect(screen.getByText(tokens.summary)).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getAllByText("No reviews yet").length).toBeGreaterThan(0);
  });

  it("formats the average when reviews exist", () => {
    renderView({
      summaries: { tokens: summary({ count: 3n, sum: 12n, average: 4 }) },
      distributions: { tokens: distribution({ 4: 2n, 5: 1n }) },
    });
    expect(screen.getByText("4.0")).toBeTruthy();
  });
});

describe("ResourcesView histogram", () => {
  it("is hidden when the selected resource has no reviews", () => {
    const { container } = renderView();
    expect(container.querySelector(".rating-histogram")).toBeNull();
  });

  it("renders five rows with aria-pressed reflecting the active filter", () => {
    const { container } = renderView({
      summaries: { tokens: summary({ count: 3n, average: 4.3 }) },
      distributions: { tokens: distribution({ 4: 2n, 5: 1n }) },
      reviewFilter: 5,
    });
    const rows = container.querySelectorAll(".histogram-row");
    expect(rows).toHaveLength(5);
    // RATING_ROWS render 5 first; the 5★ row is pressed when reviewFilter === 5.
    expect(rows[0].getAttribute("aria-pressed")).toBe("true");
    expect(rows[1].getAttribute("aria-pressed")).toBe("false");
  });

  it("selects a rating when clicking an inactive histogram row", () => {
    const onReviewFilterChange = vi.fn();
    const { container } = renderView({
      summaries: { tokens: summary({ count: 3n, average: 4.3 }) },
      distributions: { tokens: distribution({ 4: 2n, 5: 1n }) },
      reviewFilter: null,
      onReviewFilterChange,
    });
    const rows =
      container.querySelectorAll<HTMLButtonElement>(".histogram-row");
    // Clicking the 5★ row (first) with no active filter selects 5.
    fireEvent.click(rows[0]);
    expect(onReviewFilterChange).toHaveBeenCalledWith(5);
  });

  it("clears the filter when clicking the already-active histogram row", () => {
    const onReviewFilterChange = vi.fn();
    const { container } = renderView({
      summaries: { tokens: summary({ count: 3n, average: 4.3 }) },
      distributions: { tokens: distribution({ 4: 2n, 5: 1n }) },
      reviewFilter: 5,
      onReviewFilterChange,
    });
    const rows =
      container.querySelectorAll<HTMLButtonElement>(".histogram-row");
    // The 5★ row (first) is active; clicking it again clears the filter.
    fireEvent.click(rows[0]);
    expect(onReviewFilterChange).toHaveBeenCalledWith(null);
  });
});
