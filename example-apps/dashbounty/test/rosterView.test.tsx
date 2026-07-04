// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the session and dash modules directly so the test never loads
// @dashevo/evo-sdk (contract.ts / rotatePanelRoster.ts import it
// statically).
const sessionState = {
  status: "authenticated",
  sdk: {},
  keyManager: {},
  identityId: "owner-1",
  contractId: "contract-1",
  log: vi.fn(),
};

vi.mock("../src/session/useSession", () => ({
  useSession: () => sessionState,
}));

vi.mock("../src/dash/panel", () => ({
  fetchActivePanelPosition: vi.fn().mockResolvedValue(0),
  fetchPanelMembers: vi
    .fn()
    .mockResolvedValue(["panelist-a", "panelist-b", "panelist-c"]),
}));

vi.mock("../src/dash/contract", () => ({
  fetchContractOwnerId: vi.fn().mockResolvedValue("owner-1"),
}));

vi.mock("../src/dash/rotatePanelRoster", () => ({
  rotatePanelRoster: vi.fn().mockResolvedValue(1),
}));

describe("RosterView", () => {
  beforeEach(() => {
    sessionState.identityId = "owner-1";
    sessionState.status = "authenticated";
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the contract owner a 3-member rotation form", async () => {
    const { RosterView } = await import("../src/components/RosterView");
    const { container } = render(<RosterView />);

    await waitFor(() => {
      expect(screen.getByTitle("panelist-a")).toBeTruthy();
      expect(
        screen.getByRole("button", { name: /rotate panel/i }),
      ).toBeTruthy();
    });

    // Exactly 3 replacement-member inputs — a full roster, not add/remove.
    expect(container.querySelectorAll("input")).toHaveLength(3);

    // The copy explains the real mechanics (append + repoint) instead of
    // claiming rotation is impossible.
    expect(screen.queryByText(/fixed at contract registration/i)).toBeNull();
    expect(screen.getByText(/appending a new 3-member group/i)).toBeTruthy();
  });

  it("submits all 3 trimmed member IDs to rotatePanelRoster and refreshes", async () => {
    const { rotatePanelRoster } = await import("../src/dash/rotatePanelRoster");
    const { RosterView } = await import("../src/components/RosterView");
    render(<RosterView />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /rotate panel/i }),
      ).toBeTruthy(),
    );

    fireEvent.change(screen.getByLabelText("New member 1"), {
      target: { value: " panelist-d " },
    });
    fireEvent.change(screen.getByLabelText("New member 2"), {
      target: { value: "panelist-e" },
    });
    fireEvent.change(screen.getByLabelText("New member 3"), {
      target: { value: "panelist-f" },
    });
    fireEvent.click(screen.getByRole("button", { name: /rotate panel/i }));

    await waitFor(() =>
      expect(rotatePanelRoster).toHaveBeenCalledWith(
        expect.objectContaining({
          contractId: "contract-1",
          newPanelMemberIds: ["panelist-d", "panelist-e", "panelist-f"],
        }),
      ),
    );
  });

  it("hides rotation controls from non-owners", async () => {
    sessionState.identityId = "panelist-a";
    const { RosterView } = await import("../src/components/RosterView");
    const { container } = render(<RosterView />);

    await waitFor(() => {
      expect(screen.getByTitle("panelist-a")).toBeTruthy();
    });

    // Only the contract owner can repoint the main control group
    // (mainControlGroupCanBeModified: ContractOwner) — nobody else gets a
    // form that would just fail on-chain.
    expect(screen.queryByRole("button", { name: /rotate panel/i })).toBeNull();
    expect(container.querySelector("form")).toBeNull();
  });
});
