// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock the session and dash modules directly so the test never loads
// @dashevo/evo-sdk (contract.ts imports it statically).
vi.mock("../src/session/useSession", () => ({
  useSession: () => ({
    sdk: {},
    keyManager: {},
    identityId: "owner-1",
    contractId: "contract-1",
    log: vi.fn(),
  }),
}));

vi.mock("../src/dash/panel", () => ({
  fetchPanelMembers: vi
    .fn()
    .mockResolvedValue(["panelist-a", "panelist-b", "panelist-c"]),
}));

vi.mock("../src/dash/contract", () => ({
  fetchContractOwnerId: vi.fn().mockResolvedValue("owner-1"),
}));

describe("RosterView", () => {
  it("lists panel members without exposing any roster mutation controls", async () => {
    const { RosterView } = await import("../src/components/RosterView");
    const { container } = render(<RosterView />);

    await waitFor(() => {
      expect(screen.getByTitle("panelist-a")).toBeTruthy();
      expect(screen.getByTitle("panelist-b")).toBeTruthy();
      expect(screen.getByTitle("panelist-c")).toBeTruthy();
    });

    // Even signed in as the contract owner there must be no update path —
    // Platform rejects contract updates that change an existing group
    // (DataContractUpdateActionNotAllowedError), so offering one would be
    // a protocol-impossible action.
    expect(screen.queryByRole("button", { name: /update roster/i })).toBeNull();
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("input")).toBeNull();

    // The view explains why the roster can't change.
    expect(screen.getByText(/fixed at contract registration/i)).toBeTruthy();
  });
});
