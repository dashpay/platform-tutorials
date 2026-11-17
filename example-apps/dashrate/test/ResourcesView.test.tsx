// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RESOURCES } from "../src/catalog/resources";
import type { RatingDistribution, RatingSummary } from "../src/dash/queries";
import type { Leaderboards } from "../src/lib/ratings";

// Stub the heavy leaf children so the test targets the ResourcesView shell:
// the resource list, the detail head, and the histogram.
vi.mock("../src/components/ReviewForm", () => ({
  ReviewForm: () => <div data-testid="review-form" />,
}));
vi.mock("../src/components/RecentReviews", () => ({
  RecentReviews: () => <div data-testid="recent-reviews" />,
}));
vi.mock("../src/components/Leaderboard", () => ({
  Leaderboard: ({
    topRated,
    mostReviewed,
    loading,
    onSelectResource,
  }: {
    topRated: { resourceId: string }[];
    mostReviewed: { resourceId: string }[];
    loading: boolean;
    onSelectResource: (resourceId: string) => void;
  }) => (
    <>
      <div data-testid="leaderboard">
        {loading ? "loading" : topRated.map((e) => e.resourceId).join(",")}
      </div>
      {mostReviewed.map((e) => (
        <button
          key={e.resourceId}
          data-testid={`leaderboard-pick-${e.resourceId}`}
          onClick={() => onSelectResource(e.resourceId)}
        />
      ))}
    </>
  ),
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
    hasMoreReviews: false,
    loadingMoreReviews: false,
    reviewFilter: null,
    loadingRatings: false,
    leaderboards: null,
    leaderboardsLoading: false,
    leaderboardsError: "",
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
    onLoadMoreReviews: vi.fn(),
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

describe("ResourcesView 4★+ filter", () => {
  const boards: Leaderboards = {
    topRated: [{ resourceId: "dashproof-lab", value: 5 }],
    mostReviewed: [],
    highlyRated: ["dashproof-lab", "dashmint-lab"],
  };

  it("is disabled until the having set has loaded", () => {
    renderView();
    const chip = screen.getByRole("button", { name: "4★+ average" });
    expect((chip as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(/qualify$/)).toBeNull();
  });

  it("is labeled as a filter and shows the match count before it's used", () => {
    renderView({ leaderboards: boards });
    expect(screen.getByText("Filter")).toBeTruthy();
    expect(screen.getByText(`2 of ${RESOURCES.length} qualify`)).toBeTruthy();
    const chip = screen.getByRole("button", { name: "4★+ average" });
    expect(chip.getAttribute("title")).toMatch(/documents\.having/);
  });

  it("narrows the list to the resources the having query returned", () => {
    const { container } = renderView({ leaderboards: boards });
    const chip = screen.getByRole("button", { name: "4★+ average" });
    expect(chip.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(chip);

    expect(chip.getAttribute("aria-pressed")).toBe("true");
    const titles = [...container.querySelectorAll(".resource-card strong")].map(
      (el) => el.textContent,
    );
    expect(titles).toEqual(["DashMint Lab", "DashProof Lab"]);
    expect(screen.getByText(`2 of ${RESOURCES.length} qualify`)).toBeTruthy();
  });

  it("turns off when a leaderboard pick is a resource it hides", () => {
    const { container } = renderView({
      leaderboards: {
        ...boards,
        mostReviewed: [{ resourceId: "tokens", value: 4 }],
      },
    });
    const chip = screen.getByRole("button", { name: "4★+ average" });
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByTestId("leaderboard-pick-tokens"));

    expect(chip.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelectorAll(".resource-card")).toHaveLength(
      RESOURCES.length,
    );
  });

  it("explains an empty result", () => {
    renderView({ leaderboards: { ...boards, highlyRated: [] } });
    fireEvent.click(screen.getByRole("button", { name: "4★+ average" }));
    expect(
      screen.getByText("No resource averages 4★ or more yet."),
    ).toBeTruthy();
  });

  it("passes the rankings to the leaderboard", () => {
    renderView({ leaderboards: boards });
    expect(screen.getByTestId("leaderboard").textContent).toBe("dashproof-lab");
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
