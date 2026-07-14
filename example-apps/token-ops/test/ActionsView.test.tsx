// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchTokenOpsGovernance } from "../src/dash/governance";
import { useSession } from "../src/session/useSession";

vi.mock("../src/dash/governance", () => ({
  fetchTokenOpsGovernance: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: vi.fn(),
}));

vi.mock("../src/components/ProposeActionPanel", () => ({
  ProposeActionPanel: ({
    governance,
  }: {
    governance: { groups: unknown[] } | null;
  }) => <p>Proposal groups: {governance?.groups.length ?? 0}</p>,
}));

vi.mock("../src/components/PendingActionsView", () => ({
  PendingActionsView: ({
    governance,
    refreshGovernance,
  }: {
    governance: { groups: unknown[] } | null;
    refreshGovernance: () => Promise<unknown>;
  }) => (
    <div>
      <p>Queue groups: {governance?.groups.length ?? 0}</p>
      <button type="button" onClick={() => void refreshGovernance()}>
        Refresh shared governance
      </button>
    </div>
  ),
}));

import { ActionsView } from "../src/components/ActionsView";

describe("ActionsView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads one governance snapshot for both proposal and queue", async () => {
    const sdk = {};
    vi.mocked(useSession).mockReturnValue({
      sdk,
      contractId: "contract-1",
    } as never);
    vi.mocked(fetchTokenOpsGovernance).mockResolvedValue({
      groups: [{ groupPosition: 0 }],
      rules: [],
    } as never);

    render(<ActionsView />);

    await waitFor(() =>
      expect(screen.getByText("Proposal groups: 1")).toBeTruthy(),
    );
    expect(screen.getByText("Queue groups: 1")).toBeTruthy();
    expect(fetchTokenOpsGovernance).toHaveBeenCalledOnce();
    expect(fetchTokenOpsGovernance).toHaveBeenCalledWith({
      sdk,
      contractId: "contract-1",
    });
  });

  it("updates both consumers when the queue requests a governance refresh", async () => {
    vi.mocked(useSession).mockReturnValue({
      sdk: {},
      contractId: "contract-1",
    } as never);
    vi.mocked(fetchTokenOpsGovernance)
      .mockResolvedValueOnce({
        groups: [{ groupPosition: 0 }],
        rules: [],
      } as never)
      .mockResolvedValueOnce({
        groups: [{ groupPosition: 0 }, { groupPosition: 1 }],
        rules: [],
      } as never);

    render(<ActionsView />);
    await screen.findByText("Queue groups: 1");

    fireEvent.click(
      screen.getByRole("button", { name: "Refresh shared governance" }),
    );

    await screen.findByText("Proposal groups: 2");
    expect(screen.getByText("Queue groups: 2")).toBeTruthy();
    expect(fetchTokenOpsGovernance).toHaveBeenCalledTimes(2);
  });
});
