// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchGovernance: vi.fn(),
  fetchIdentityStates: vi.fn(),
  fetchOverview: vi.fn(),
  listPending: vi.fn(),
  listSigners: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: mocks.useSession,
}));

vi.mock("../src/dash/governance", () => ({
  fetchTokenOpsGovernance: mocks.fetchGovernance,
}));

vi.mock("../src/dash/groupActions", () => ({
  listActionSigners: mocks.listSigners,
  listPendingActions: mocks.listPending,
}));

vi.mock("../src/dash/token", () => ({
  fetchIdentityTokenStates: mocks.fetchIdentityStates,
  fetchTokenOverview: mocks.fetchOverview,
}));

vi.mock("../src/hooks/useDpnsNames", () => ({
  useDpnsNames: () => ({}),
}));

vi.mock("../src/components/IdentityLabel", () => ({
  IdentityLabel: ({ id }: { id: string }) => <span>{id}</span>,
}));

import { OverviewView } from "../src/components/OverviewView";

const GROUP_MEMBER = "group-member-id";

describe("OverviewView identity balance inspector", () => {
  beforeEach(() => {
    mocks.useSession.mockReturnValue({
      sdk: {},
      contractId: "contract-id",
      identityId: null,
    });
    mocks.fetchOverview.mockResolvedValue({
      tokenId: "token-id",
      totalSupply: 100n,
      isPaused: false,
      metadata: { name: "TokenOps", description: "Governed token" },
      supplyConfig: {
        baseSupply: 100n,
        maxSupply: 10_000n,
        hasPerpetualDistribution: false,
        hasPreProgrammedDistribution: false,
      },
    });
    mocks.fetchGovernance.mockResolvedValue({
      groups: [
        {
          groupPosition: 0,
          members: new Map([[GROUP_MEMBER, 1]]),
          requiredPower: 1,
        },
      ],
      rules: [
        {
          key: "manualMinting",
          label: "Manual minting",
          ruleName: "manualMintingRules",
          operator: { type: "Group", groupPosition: 0 },
          admin: { type: "ContractOwner" },
          canSetOperatorToNoOne: false,
          canSetAdminToNoOne: false,
          supportsGroupAction: true,
        },
      ],
    });
    mocks.listPending.mockResolvedValue([]);
    mocks.fetchIdentityStates.mockResolvedValue(
      new Map([[GROUP_MEMBER, { balance: 42n, isFrozen: false }]]),
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads group-member balances only after the inspector is opened", async () => {
    render(
      <OverviewView
        onNavigateToPending={vi.fn()}
        onNavigateToGovernance={vi.fn()}
      />,
    );

    await screen.findByRole("heading", { name: "Who controls what" });
    expect(mocks.fetchIdentityStates).not.toHaveBeenCalled();

    const summary = screen.getByText("Check balances").closest("summary");
    const details = summary?.closest("details");
    expect(details).toBeTruthy();
    if (!details) return;
    details.open = true;
    fireEvent(details, new Event("toggle"));

    await waitFor(() =>
      expect(mocks.fetchIdentityStates).toHaveBeenCalledWith({
        sdk: {},
        contractId: "contract-id",
        identityIds: [GROUP_MEMBER],
      }),
    );
    expect(await screen.findByText(GROUP_MEMBER)).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
  });
});
