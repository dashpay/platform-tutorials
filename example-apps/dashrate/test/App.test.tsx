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
  registerContract,
  saveReview,
  fetchReviewHistory,
  loadSdkCore,
  createClient,
  identityKeyManagerCreate,
  ratingsState,
  myReviewsState,
} = vi.hoisted(() => ({
  loadStoredContractId: vi.fn<() => string>(),
  saveContractId: vi.fn(),
  clearStoredContractId: vi.fn(),
  registerContract: vi.fn().mockResolvedValue("new-contract-id"),
  saveReview: vi.fn().mockResolvedValue("review-id"),
  fetchReviewHistory: vi.fn().mockResolvedValue([]),
  loadSdkCore: vi.fn(),
  createClient: vi.fn(),
  identityKeyManagerCreate: vi.fn(),
  ratingsState: {
    summaries: {},
    distributions: {},
    reviews: [] as ReviewRecord[],
    reviewFilter: null,
    setReviewFilter: vi.fn(),
    mySelectedReview: null as ReviewRecord | null,
    setMySelectedReview: vi.fn(),
    rating: null as number | null,
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
  registerContract,
}));

vi.mock("../src/dash/sdkCore", () => ({ loadSdkCore }));

vi.mock("../src/dash/review", () => ({ saveReview }));

vi.mock("../src/dash/history", () => ({ fetchReviewHistory }));

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
    onLoadHistory,
  }: {
    onSaveReview: (event: { preventDefault: () => void }) => void;
    onLoadHistory: () => void;
  }) => (
    <div data-testid="resources-view">
      <button
        type="button"
        onClick={() => onSaveReview({ preventDefault: () => {} })}
      >
        save review
      </button>
      <button type="button" onClick={onLoadHistory}>
        load history
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
    onContractSubmit,
    onRegisterContract,
  }: {
    session: { identityId: string } | null;
    onSignIn: (event: { preventDefault: () => void }) => void;
    onSignOut: () => void;
    onClearContract: () => void;
    onContractSubmit: (event: { preventDefault: () => void }) => void;
    onRegisterContract: () => void;
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
      <button
        type="button"
        onClick={() => onContractSubmit({ preventDefault: () => {} })}
      >
        do contract submit
      </button>
      <button type="button" onClick={onRegisterContract}>
        do register contract
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

/** Navigate to the Resources view (where the review form lives). */
function goToResources() {
  fireEvent.click(screen.getByRole("button", { name: /^resources$/i }));
}

/** Sign in through the Settings stub and wait for the session to land. */
async function signIn(identityId = "owner-1") {
  setSignInSuccess(identityId);
  fireEvent.click(screen.getByRole("button", { name: /^settings$/i }));
  fireEvent.click(screen.getByRole("button", { name: /do sign in/i }));
  await waitFor(() => {
    expect(screen.getByTestId("session-state").textContent).toBe(
      `signed-in:${identityId}`,
    );
  });
}

beforeEach(() => {
  // clearAllMocks wipes implementations too, so re-establish the async
  // resolutions every test.
  vi.clearAllMocks();
  loadStoredContractId.mockReturnValue("stored-contract-id");
  registerContract.mockResolvedValue("new-contract-id");
  saveReview.mockResolvedValue("review-id");
  fetchReviewHistory.mockResolvedValue([]);
  ratingsState.loadResourceData.mockResolvedValue(undefined);
  ratingsState.refreshReviews.mockResolvedValue([]);
  myReviewsState.refreshMyReviews.mockResolvedValue([]);
  ratingsState.rating = null;
  ratingsState.reviews = [];
  ratingsState.mySelectedReview = null;
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
    expect(saveReview).not.toHaveBeenCalled();
  });

  it("asks for a contract when signed in without one", async () => {
    loadStoredContractId.mockReturnValue("");
    render(<App />);
    await signIn();
    goToResources();
    fireEvent.click(screen.getByRole("button", { name: /save review/i }));
    expect(
      screen.getByText("Register or paste a DashRate contract ID first."),
    ).toBeTruthy();
    expect(saveReview).not.toHaveBeenCalled();
  });

  it("asks for a star rating when none is chosen", async () => {
    ratingsState.rating = null;
    render(<App />);
    await signIn();
    goToResources();
    fireEvent.click(screen.getByRole("button", { name: /save review/i }));
    expect(
      screen.getByText("Choose a star rating before saving your review."),
    ).toBeTruthy();
    expect(saveReview).not.toHaveBeenCalled();
  });
});

describe("App save-review success", () => {
  it("saves then refreshes ratings, my-reviews, and the review list", async () => {
    ratingsState.rating = 5;
    render(<App />);
    await signIn();
    goToResources();
    fireEvent.click(screen.getByRole("button", { name: /save review/i }));

    await waitFor(() => {
      expect(saveReview).toHaveBeenCalledOnce();
    });
    expect(saveReview).toHaveBeenCalledWith(
      expect.objectContaining({ contractId: "stored-contract-id", rating: 5 }),
    );
    // All three post-save refreshes fire.
    expect(ratingsState.loadResourceData).toHaveBeenCalled();
    expect(myReviewsState.refreshMyReviews).toHaveBeenCalled();
    expect(ratingsState.refreshReviews).toHaveBeenCalled();
  });

  it("surfaces a status when the save fails", async () => {
    ratingsState.rating = 5;
    saveReview.mockRejectedValueOnce(new Error("write rejected"));
    render(<App />);
    await signIn();
    goToResources();
    fireEvent.click(screen.getByRole("button", { name: /save review/i }));

    await waitFor(() => {
      expect(screen.getByText(/Save failed: write rejected/)).toBeTruthy();
    });
  });
});

describe("App register contract", () => {
  it("guards against registering without a session", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^settings$/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /do register contract/i }),
    );
    expect(registerContract).not.toHaveBeenCalled();
    expect(
      screen.getByText("Sign in before registering a contract."),
    ).toBeTruthy();
  });

  it("registers and switches to the new contract id", async () => {
    render(<App />);
    await signIn();
    fireEvent.click(
      screen.getByRole("button", { name: /do register contract/i }),
    );

    await waitFor(() => {
      expect(registerContract).toHaveBeenCalledOnce();
    });
    expect(
      screen.getByText("Registered new contract: new-contract-id"),
    ).toBeTruthy();
  });
});

describe("App contract submit", () => {
  it("persists and applies the pasted contract id", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^settings$/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /do contract submit/i }),
    );
    // contractInput defaults to the stored id; submitting persists it and
    // resets the my-reviews list.
    expect(saveContractId).toHaveBeenCalledWith("stored-contract-id");
    expect(myReviewsState.setMyReviews).toHaveBeenCalledWith([]);
  });
});

describe("App load history", () => {
  it("fetches history for the selected own review when none is shown", async () => {
    ratingsState.mySelectedReview = {
      id: "rev-1",
      ownerId: "owner-1",
      resourceId: "tokens",
      rating: 4,
      reviewText: "",
      createdAt: 1,
      updatedAt: 2,
      revision: 2,
    };
    render(<App />);
    await signIn();
    goToResources();
    fireEvent.click(screen.getByRole("button", { name: /load history/i }));

    await waitFor(() => {
      expect(fetchReviewHistory).toHaveBeenCalledOnce();
    });
    expect(fetchReviewHistory).toHaveBeenCalledWith(
      expect.objectContaining({ reviewId: "rev-1" }),
    );
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
