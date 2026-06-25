// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReviewRecord } from "../src/dash/queries";
import type { DashKeyManager, DashSdk } from "../src/dash/types";

// --- Hoisted spies for the mocked modules -------------------------------

const {
  loadStoredContractId,
  saveContractId,
  clearStoredContractId,
  loadSdkCore,
  createClient,
  identityKeyManagerCreate,
  ratingsState,
  myReviewsState,
} = vi.hoisted(() => ({
  loadStoredContractId: vi.fn<() => string>(),
  saveContractId: vi.fn(),
  clearStoredContractId: vi.fn(),
  loadSdkCore: vi.fn(),
  createClient: vi.fn(),
  identityKeyManagerCreate: vi.fn(),
  ratingsState: {
    summaries: {},
    distributions: {},
    reviews: [] as ReviewRecord[],
    reviewFilter: null,
    setReviewFilter: vi.fn(),
    mySelectedReview: null,
    setMySelectedReview: vi.fn(),
    rating: null,
    setRating: vi.fn(),
    hoverRating: null,
    setHoverRating: vi.fn(),
    reviewText: "",
    setReviewText: vi.fn(),
    loadingRatings: false,
    loadResourceData: vi.fn().mockResolvedValue(undefined),
    refreshReviews: vi.fn().mockResolvedValue([]),
  },
  myReviewsState: {
    myReviews: [] as ReviewRecord[],
    setMyReviews: vi.fn(),
    myReviewsLoading: false,
    myReviewsAverage: null,
    fetchMyReviews: vi.fn().mockResolvedValue([]),
    refreshMyReviews: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../src/dash/contract", () => ({
  loadStoredContractId,
  saveContractId,
  clearStoredContractId,
  registerContract: vi.fn().mockResolvedValue("new-contract-id"),
}));

vi.mock("../src/dash/sdkCore", () => ({ loadSdkCore }));

vi.mock("../src/dash/review", () => ({
  saveReview: vi.fn().mockResolvedValue("review-id"),
}));

vi.mock("../src/dash/history", () => ({
  fetchReviewHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock("../src/hooks/useResourceRatings", () => ({
  useResourceRatings: () => ratingsState,
}));

vi.mock("../src/hooks/useMyReviews", () => ({
  useMyReviews: () => myReviewsState,
}));

vi.mock("../src/hooks/useDpnsNames", () => ({
  useDpnsNames: () => ({}),
}));

// View stubs surface the props App wires and expose buttons to trigger
// orchestration handlers.
vi.mock("../src/components/ResourcesView", () => ({
  ResourcesView: ({
    onSaveReview,
  }: {
    onSaveReview: (event: { preventDefault: () => void }) => void;
  }) => (
    <div data-testid="resources-view">
      <button
        type="button"
        onClick={() => onSaveReview({ preventDefault: () => {} })}
      >
        save review
      </button>
    </div>
  ),
}));

vi.mock("../src/components/MyReviewsView", () => ({
  MyReviewsView: ({ onEdit }: { onEdit: (review: ReviewRecord) => void }) => (
    <div data-testid="my-reviews-view">
      <button
        type="button"
        onClick={() =>
          onEdit({
            id: "r1",
            ownerId: "owner-1",
            resourceId: "tokens",
            rating: 4,
            reviewText: "edit me",
            createdAt: 1,
            updatedAt: 2,
            revision: 1,
          })
        }
      >
        edit my review
      </button>
    </div>
  ),
}));

vi.mock("../src/components/SettingsView", () => ({
  // Surface the session App passes down so tests can assert that sign-in
  // actually called setSession — not merely that the SDK ran without error.
  SettingsView: ({
    session,
    onSignIn,
    onSignOut,
    onClearContract,
  }: {
    session: { identityId: string } | null;
    onSignIn: (event: { preventDefault: () => void }) => void;
    onSignOut: () => void;
    onClearContract: () => void;
  }) => (
    <div data-testid="settings-view">
      <p data-testid="session-state">
        {session ? `signed-in:${session.identityId}` : "signed-out"}
      </p>
      <button
        type="button"
        onClick={() => onSignIn({ preventDefault: () => {} })}
      >
        do sign in
      </button>
      <button type="button" onClick={onSignOut}>
        do sign out
      </button>
      <button type="button" onClick={onClearContract}>
        do clear contract
      </button>
    </div>
  ),
}));

vi.mock("../src/components/HowItWorks", () => ({
  HowItWorks: () => <div data-testid="how-it-works" />,
}));

const App = (await import("../src/App")).default;

function setSignInSuccess(identityId: string | null) {
  createClient.mockResolvedValue({} as DashSdk);
  identityKeyManagerCreate.mockResolvedValue({
    identityId,
  } as unknown as DashKeyManager);
  loadSdkCore.mockResolvedValue({
    createClient,
    IdentityKeyManager: { create: identityKeyManagerCreate },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  loadStoredContractId.mockReturnValue("stored-contract-id");
  ratingsState.rating = null;
  ratingsState.reviews = [];
  myReviewsState.myReviews = [];
});

afterEach(() => {
  cleanup();
});

describe("App view routing", () => {
  it("shows the Resources view by default", () => {
    render(<App />);
    expect(screen.getByTestId("resources-view")).toBeTruthy();
  });

  it("switches views via the top nav", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^how it works$/i }));
    expect(screen.getByTestId("how-it-works")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^settings$/i }));
    expect(screen.getByTestId("settings-view")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^my reviews$/i }));
    expect(screen.getByTestId("my-reviews-view")).toBeTruthy();
  });
});

describe("App contract notice", () => {
  it("renders the no-contract notice when nothing is stored", () => {
    loadStoredContractId.mockReturnValue("");
    render(<App />);
    expect(screen.getByText(/No default contract is bundled yet/)).toBeTruthy();
  });

  it("hides the notice when a contract id is stored", () => {
    render(<App />);
    expect(screen.queryByText(/No default contract is bundled yet/)).toBeNull();
  });
});

describe("App sign-in", () => {
  it("establishes a session on a successful sign in", async () => {
    setSignInSuccess("owner-1");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^settings$/i }));
    expect(screen.getByTestId("session-state").textContent).toBe("signed-out");

    fireEvent.click(screen.getByRole("button", { name: /do sign in/i }));

    // setSession ran with the resolved identity — proven by the session the
    // stub renders, not just by the SDK call returning without error.
    await waitFor(() => {
      expect(screen.getByTestId("session-state").textContent).toBe(
        "signed-in:owner-1",
      );
    });
    expect(identityKeyManagerCreate).toHaveBeenCalled();
    expect(screen.queryByText(/Sign-in failed/)).toBeNull();
  });

  it("surfaces a status and stays signed out when no identity resolves", async () => {
    setSignInSuccess("");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^settings$/i }));
    fireEvent.click(screen.getByRole("button", { name: /do sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/Sign-in failed/)).toBeTruthy();
    });
    expect(screen.getByTestId("session-state").textContent).toBe("signed-out");
  });

  it("clears the session on sign out", async () => {
    setSignInSuccess("owner-1");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^settings$/i }));
    fireEvent.click(screen.getByRole("button", { name: /do sign in/i }));
    await waitFor(() => {
      expect(screen.getByTestId("session-state").textContent).toBe(
        "signed-in:owner-1",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /do sign out/i }));
    expect(screen.getByTestId("session-state").textContent).toBe("signed-out");
  });
});

describe("App save-review guards", () => {
  it("asks the user to sign in before saving without a session", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /save review/i }));
    expect(screen.getByText("Sign in before saving a review.")).toBeTruthy();
  });
});

describe("App edit-my-review", () => {
  it("switches to Resources and seeds the composer from the review", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^my reviews$/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit my review/i }));

    expect(screen.getByTestId("resources-view")).toBeTruthy();
    expect(ratingsState.setMySelectedReview).toHaveBeenCalled();
    expect(ratingsState.setRating).toHaveBeenCalledWith(4);
    expect(ratingsState.setReviewText).toHaveBeenCalledWith("edit me");
  });
});

describe("App contract clearing", () => {
  it("clears stored contract state", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^settings$/i }));
    fireEvent.click(screen.getByRole("button", { name: /do clear contract/i }));
    expect(clearStoredContractId).toHaveBeenCalledOnce();
    expect(myReviewsState.setMyReviews).toHaveBeenCalledWith([]);
    expect(ratingsState.setMySelectedReview).toHaveBeenCalledWith(null);
  });
});
