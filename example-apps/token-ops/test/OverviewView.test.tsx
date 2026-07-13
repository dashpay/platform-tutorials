// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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

function rule(
  key: string,
  label: string,
  operator: Record<string, unknown>,
  supportsGroupAction = true,
) {
  return {
    key,
    label,
    ruleName: `${key}Rules`,
    operator,
    admin: { type: "ContractOwner" },
    canSetOperatorToNoOne: false,
    canSetAdminToNoOne: false,
    supportsGroupAction,
  };
}

describe("OverviewView dashboard", () => {
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

    const customIdentity = "custom-identity-id";
    mocks.fetchIdentityStates.mockResolvedValueOnce(
      new Map([[customIdentity, { balance: 7n, isFrozen: true }]]),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Identity ID" }), {
      target: { value: customIdentity },
    });
    fireEvent.click(screen.getByRole("button", { name: "Inspect" }));

    await waitFor(() =>
      expect(mocks.fetchIdentityStates).toHaveBeenLastCalledWith({
        sdk: {},
        contractId: "contract-id",
        identityIds: [customIdentity],
      }),
    );
    expect(await screen.findByText(customIdentity)).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("Frozen")).toBeTruthy();
  });

  it("aggregates capabilities into real-group and pseudo-group cards", async () => {
    mocks.fetchGovernance.mockResolvedValue({
      groups: [
        {
          groupPosition: 0,
          members: new Map([
            ["member-a", 1],
            ["member-b", 1],
          ]),
          requiredPower: 2,
        },
        {
          groupPosition: 9,
          members: new Map([["unused-member", 1]]),
          requiredPower: 1,
        },
      ],
      rules: [
        rule("manualMinting", "Manual minting", {
          type: "Group",
          groupPosition: 0,
        }),
        rule("manualBurning", "Manual burning", {
          type: "Group",
          groupPosition: 0,
        }),
        rule("freeze", "Freeze", { type: "ContractOwner" }),
        rule("unfreeze", "Unfreeze", { type: "ContractOwner" }),
        rule("destroyFrozenFunds", "Destroy frozen funds", {
          type: "NoOne",
        }),
        rule("emergencyAction", "Emergency pause/resume", {
          type: "MainGroup",
        }),
        rule("customAction", "Custom action", { type: "Unknown" }),
      ],
    });

    const { container } = render(
      <OverviewView
        onNavigateToPending={vi.fn()}
        onNavigateToGovernance={vi.fn()}
      />,
    );

    const mint = await screen.findByText("Mint");
    const groupCard = mint.closest("article");
    expect(groupCard).toBeTruthy();
    if (!groupCard) return;
    expect(within(groupCard).getByText("Burn")).toBeTruthy();
    expect(within(groupCard).getByText("Group 0")).toBeTruthy();
    expect(
      within(groupCard).getByText("2 power required · 2 members"),
    ).toBeTruthy();

    const ownerCard = screen.getByText("Freeze").closest("article");
    expect(ownerCard).toBeTruthy();
    if (!ownerCard) return;
    expect(within(ownerCard).getByText("Unfreeze")).toBeTruthy();
    expect(within(ownerCard).getByText("Contract owner")).toBeTruthy();

    const disabledCard = screen
      .getByText("Destroy frozen funds")
      .closest("article");
    expect(disabledCard).toBeTruthy();
    if (!disabledCard) return;
    expect(within(disabledCard).getByText("No one")).toBeTruthy();
    expect(
      within(disabledCard).getByText("These capabilities are disabled"),
    ).toBeTruthy();

    const mainGroupCard = screen.getByText("Pause / resume").closest("article");
    expect(mainGroupCard).toBeTruthy();
    if (!mainGroupCard) return;
    expect(within(mainGroupCard).getByText("Main control group")).toBeTruthy();

    const unknownCard = screen.getByText("Custom action").closest("article");
    expect(unknownCard).toBeTruthy();
    if (!unknownCard) return;
    expect(within(unknownCard).getByText("Unknown authority")).toBeTruthy();
    expect(
      within(unknownCard).getByText("Authority could not be resolved"),
    ).toBeTruthy();

    expect(screen.queryByText("Group 9")).toBeNull();
    expect(container.querySelectorAll(".dashboard-group-card")).toHaveLength(5);
  });

  it("combines capabilities for the same identity and separates distinct identities", async () => {
    const identityA = "identity-alpha-111111111111";
    const identityB = "identity-beta-222222222222";
    mocks.fetchGovernance.mockResolvedValue({
      groups: [],
      rules: [
        rule("manualMinting", "Manual minting", {
          type: "Identity",
          identityId: identityA,
        }),
        rule("manualBurning", "Manual burning", {
          type: "Identity",
          identityId: identityA,
        }),
        rule("freeze", "Freeze", {
          type: "Identity",
          identityId: identityB,
        }),
        rule("maxSupply", "Max supply", { type: "ContractOwner" }, false),
      ],
    });

    const { container } = render(
      <OverviewView
        onNavigateToPending={vi.fn()}
        onNavigateToGovernance={vi.fn()}
      />,
    );

    const identityACard = (await screen.findByText("Mint")).closest("article");
    const identityBCard = screen.getByText("Freeze").closest("article");
    expect(identityACard).toBeTruthy();
    expect(identityBCard).toBeTruthy();
    expect(identityACard).not.toBe(identityBCard);
    if (!identityACard || !identityBCard) return;

    expect(within(identityACard).getByText("Burn")).toBeTruthy();
    expect(
      within(identityACard).getByText("Identity identi…111111"),
    ).toBeTruthy();
    expect(
      within(identityBCard).getByText("Identity identi…222222"),
    ).toBeTruthy();
    expect(screen.queryByText("Max supply")).toBeNull();
    expect(container.querySelectorAll(".dashboard-group-card")).toHaveLength(2);
  });

  it("shows total proposals, unsigned proposals, and the signed-in member's access", async () => {
    const signedInIdentity = "signed-in-member";
    mocks.useSession.mockReturnValue({
      sdk: {},
      contractId: "contract-id",
      identityId: signedInIdentity,
    });
    mocks.fetchGovernance.mockResolvedValue({
      groups: [
        {
          groupPosition: 0,
          members: new Map([
            [signedInIdentity, 1],
            ["other-member", 1],
          ]),
          requiredPower: 2,
        },
      ],
      rules: [
        rule("manualMinting", "Manual minting", {
          type: "Group",
          groupPosition: 0,
        }),
        rule("manualBurning", "Manual burning", {
          type: "Group",
          groupPosition: 0,
        }),
      ],
    });
    mocks.listPending.mockResolvedValue([
      {
        actionId: "needs-signature",
        proposerId: "other-member",
        eventName: "TokenMintEvent",
        params: {
          kind: "mint",
          amount: 10n,
          recipientId: "recipient-id",
        },
      },
      {
        actionId: "already-signed",
        proposerId: signedInIdentity,
        eventName: "TokenBurnEvent",
        params: {
          kind: "burn",
          amount: 2n,
          burnFromId: signedInIdentity,
        },
      },
    ]);
    mocks.listSigners.mockImplementation(
      async ({ actionId }: { actionId: string }) => ({
        signers: new Map(),
        signedPower: 1n,
        requiredPower: 2,
        hasSigned: () => actionId === "already-signed",
      }),
    );

    render(
      <OverviewView
        onNavigateToPending={vi.fn()}
        onNavigateToGovernance={vi.fn()}
      />,
    );

    await screen.findByRole("heading", { name: "Your signature is needed" });
    const needsCard = screen
      .getByText("Needs your signature")
      .closest("button");
    const allCard = screen.getByText("All active proposals").closest("button");
    expect(needsCard).toBeTruthy();
    expect(allCard).toBeTruthy();
    if (!needsCard || !allCard) return;
    expect(
      within(needsCard).getByText("1", { selector: "strong" }),
    ).toBeTruthy();
    expect(within(allCard).getByText("2", { selector: "strong" })).toBeTruthy();
    expect(screen.getByText("1 group")).toBeTruthy();
    const accessCard = screen
      .getByText("Your governance access")
      .closest("section");
    expect(accessCard).toBeTruthy();
    if (!accessCard) return;
    expect(within(accessCard).getByText(/^Group 0\b/)).toBeTruthy();
    expect(mocks.listSigners).toHaveBeenCalledTimes(2);
  });

  it("shows all proposals but skips signer lookups for a nonmember", async () => {
    mocks.useSession.mockReturnValue({
      sdk: {},
      contractId: "contract-id",
      identityId: "nonmember-identity",
    });
    mocks.listPending.mockResolvedValue([
      {
        actionId: "group-action",
        proposerId: GROUP_MEMBER,
        eventName: "TokenMintEvent",
        params: {
          kind: "mint",
          amount: 10n,
          recipientId: "recipient-id",
        },
      },
    ]);

    render(
      <OverviewView
        onNavigateToPending={vi.fn()}
        onNavigateToGovernance={vi.fn()}
      />,
    );

    await screen.findByText("No operator groups");
    const needsCard = screen
      .getByText("Needs your signature")
      .closest("button");
    const allCard = screen.getByText("All active proposals").closest("button");
    expect(needsCard).toBeTruthy();
    expect(allCard).toBeTruthy();
    if (!needsCard || !allCard) return;
    expect(
      within(needsCard).getByText("0", { selector: "strong" }),
    ).toBeTruthy();
    expect(within(allCard).getByText("1", { selector: "strong" })).toBeTruthy();
    expect(
      screen.getByText("This identity cannot propose group-managed actions"),
    ).toBeTruthy();
    expect(mocks.listSigners).not.toHaveBeenCalled();
  });

  it("invokes the pending and governance navigation callbacks", async () => {
    const onNavigateToPending = vi.fn();
    const onNavigateToGovernance = vi.fn();
    render(
      <OverviewView
        onNavigateToPending={onNavigateToPending}
        onNavigateToGovernance={onNavigateToGovernance}
      />,
    );

    await screen.findByText("Mint");
    const needsCard = screen
      .getByText("Needs your signature")
      .closest("button");
    const allCard = screen.getByText("All active proposals").closest("button");
    expect(needsCard).toBeTruthy();
    expect(allCard).toBeTruthy();
    if (!needsCard || !allCard) return;

    fireEvent.click(needsCard);
    fireEvent.click(allCard);
    fireEvent.click(screen.getByRole("button", { name: "Open governance" }));

    expect(onNavigateToPending).toHaveBeenCalledTimes(2);
    expect(onNavigateToGovernance).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Signed out")).toBeTruthy();
  });

  it("shows stable loading placeholders while dashboard data is pending", () => {
    const pending = new Promise<never>(() => undefined);
    mocks.useSession.mockReturnValue({
      sdk: {},
      contractId: "contract-id",
      identityId: "signed-in-identity",
    });
    mocks.fetchOverview.mockReturnValue(pending);
    mocks.fetchGovernance.mockReturnValue(pending);

    render(
      <OverviewView
        onNavigateToPending={vi.fn()}
        onNavigateToGovernance={vi.fn()}
      />,
    );

    const needsCard = screen
      .getByText("Needs your signature")
      .closest("button");
    const allCard = screen.getByText("All active proposals").closest("button");
    expect(needsCard).toBeTruthy();
    expect(allCard).toBeTruthy();
    if (!needsCard || !allCard) return;
    expect(
      within(needsCard).getByText("…", { selector: "strong" }),
    ).toBeTruthy();
    expect(within(allCard).getByText("…", { selector: "strong" })).toBeTruthy();
    expect(screen.getByText("Loading governance…")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Loading…", level: 3 }),
    ).toBeTruthy();
  });

  it("surfaces dashboard loading failures", async () => {
    mocks.fetchOverview.mockRejectedValueOnce(
      new Error("Unable to load dashboard"),
    );

    render(
      <OverviewView
        onNavigateToPending={vi.fn()}
        onNavigateToGovernance={vi.fn()}
      />,
    );

    expect(await screen.findByText("Unable to load dashboard")).toBeTruthy();
  });

  it("prompts for configuration without requesting dashboard data", () => {
    mocks.useSession.mockReturnValue({
      sdk: {},
      contractId: null,
      identityId: null,
    });

    render(
      <OverviewView
        onNavigateToPending={vi.fn()}
        onNavigateToGovernance={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Configure a TokenOps contract first."),
    ).toBeTruthy();
    expect(mocks.fetchOverview).not.toHaveBeenCalled();
    expect(mocks.fetchGovernance).not.toHaveBeenCalled();
  });
});
