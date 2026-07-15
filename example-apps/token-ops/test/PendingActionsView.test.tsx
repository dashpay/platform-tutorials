// @vitest-environment jsdom
import { useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PendingActionsView } from "../src/components/PendingActionsView";
import type { TokenOpsGovernance } from "../src/dash/governance";
import {
  listActionSigners,
  listPendingActions,
  PENDING_ACTIONS_QUERY_LIMIT,
} from "../src/dash/groupActions";
import { burnToken, mintToken } from "../src/dash/tokenOperations";
import { useSession } from "../src/session/useSession";

vi.mock("../src/dash/groupActions", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/dash/groupActions")>();
  return {
    ...actual,
    listPendingActions: vi.fn(),
    listActionSigners: vi.fn(),
  };
});

vi.mock("../src/dash/tokenOperations", () => ({
  mintToken: vi.fn(),
  burnToken: vi.fn(),
  freezeToken: vi.fn(),
  unfreezeToken: vi.fn(),
  destroyFrozenToken: vi.fn(),
  emergencyTokenAction: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: vi.fn(),
}));

function renderPending(
  initialGovernance: TokenOpsGovernance,
  loadGovernance = vi.fn().mockResolvedValue(initialGovernance),
) {
  function Harness() {
    const [governance, setGovernance] = useState(initialGovernance);
    async function refreshGovernance() {
      const nextGovernance = await loadGovernance();
      if (nextGovernance) setGovernance(nextGovernance);
      return nextGovernance;
    }
    return (
      <PendingActionsView
        governance={governance}
        refreshGovernance={refreshGovernance}
      />
    );
  }

  return render(<Harness />);
}

describe("PendingActionsView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("documents the single-query active-actions limit per group", async () => {
    vi.mocked(useSession).mockReturnValue({
      status: "authenticated",
      sdk: {},
      keyManager: { id: "key-manager" },
      contractId: "contract-1",
      identityId: "member-b",
      log: vi.fn(),
    } as never);
    const governance: TokenOpsGovernance = {
      groups: [
        {
          groupPosition: 0,
          requiredPower: 2,
          members: new Map([
            ["member-a", 1],
            ["member-b", 1],
          ]),
        },
      ],
      rules: [],
    };
    vi.mocked(listPendingActions).mockResolvedValue([]);
    vi.mocked(listActionSigners).mockResolvedValue({
      signers: new Map(),
      signedPower: 0n,
      requiredPower: 2,
      hasSigned: () => false,
    });

    renderPending(governance);

    expect(
      await screen.findByText(
        `Shows up to ${PENDING_ACTIONS_QUERY_LIMIT} active actions per group.`,
      ),
    ).toBeTruthy();
  });

  it("requires confirmation when the current signature will execute the action", async () => {
    vi.mocked(useSession).mockReturnValue({
      status: "authenticated",
      sdk: {},
      keyManager: { id: "key-manager" },
      contractId: "contract-1",
      identityId: "member-b",
      log: vi.fn(),
    } as never);
    const governance: TokenOpsGovernance = {
      groups: [
        {
          groupPosition: 0,
          requiredPower: 2,
          members: new Map([
            ["member-a", 1],
            ["member-b", 1],
          ]),
        },
      ],
      rules: [],
    };
    vi.mocked(listPendingActions).mockResolvedValue([
      {
        actionId: "action-1",
        proposerId: "member-a",
        eventName: "Token: mint",
        params: {
          kind: "mint",
          amount: 3n,
          recipientId: "recipient-1",
          publicNote: "mint note",
        },
      },
    ]);
    vi.mocked(listActionSigners).mockResolvedValue({
      signers: new Map([["member-a", 1n]]),
      signedPower: 1n,
      requiredPower: 2,
      hasSigned: (identityId: string) => identityId === "member-a",
    });
    vi.mocked(mintToken).mockResolvedValue({ groupPower: 2 });

    renderPending(governance);

    const button = await screen.findByRole("button", {
      name: "Sign & execute mint",
    });
    expect(screen.queryByText("Action ID")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByText("Action ID")).toBeTruthy();
    fireEvent.click(button);
    expect(mintToken).not.toHaveBeenCalled();
    expect(screen.getByText("Sign and execute mint")).toBeTruthy();
    expect(
      screen.getByText(/Signing runs this action on-chain now/i),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Sign & execute mint" }),
    );

    await waitFor(() =>
      expect(mintToken).toHaveBeenCalledWith(
        expect.objectContaining({
          contractId: "contract-1",
          actionId: "action-1",
          groupPosition: 0,
          amount: 3n,
          recipientId: "recipient-1",
          publicNote: "mint note",
        }),
      ),
    );
  });

  it("adds a routine non-final signature without confirmation", async () => {
    vi.mocked(useSession).mockReturnValue({
      status: "authenticated",
      sdk: {},
      keyManager: { id: "key-manager" },
      contractId: "contract-1",
      identityId: "member-b",
      log: vi.fn(),
    } as never);
    const governance: TokenOpsGovernance = {
      groups: [
        {
          groupPosition: 0,
          requiredPower: 3,
          members: new Map([
            ["member-a", 1],
            ["member-b", 1],
            ["member-c", 1],
          ]),
        },
      ],
      rules: [],
    };
    vi.mocked(listPendingActions).mockResolvedValue([
      {
        actionId: "action-2",
        proposerId: "member-a",
        eventName: "Token: mint",
        params: {
          kind: "mint",
          amount: 5n,
          recipientId: "recipient-2",
          publicNote: "mint note",
        },
      },
    ]);
    vi.mocked(listActionSigners).mockResolvedValue({
      signers: new Map(),
      signedPower: 0n,
      requiredPower: 3,
      hasSigned: () => false,
    });
    vi.mocked(mintToken).mockResolvedValue({ groupPower: 1 });

    renderPending(governance);

    const button = await screen.findByRole("button", {
      name: "Add your signature",
    });
    expect(
      screen.getByText("2 more signatures needed after yours"),
    ).toBeTruthy();
    fireEvent.click(button);

    await waitFor(() =>
      expect(mintToken).toHaveBeenCalledWith(
        expect.objectContaining({
          contractId: "contract-1",
          actionId: "action-2",
          groupPosition: 0,
          amount: 5n,
          recipientId: "recipient-2",
        }),
      ),
    );
    expect(screen.queryByText("Sign and execute mint")).toBeNull();
  });

  it("requires confirmation for destructive non-final signatures", async () => {
    vi.mocked(useSession).mockReturnValue({
      status: "authenticated",
      sdk: {},
      keyManager: { id: "key-manager" },
      contractId: "contract-1",
      identityId: "member-b",
      log: vi.fn(),
    } as never);
    const governance: TokenOpsGovernance = {
      groups: [
        {
          groupPosition: 0,
          requiredPower: 3,
          members: new Map([
            ["member-a", 1],
            ["member-b", 1],
            ["member-c", 1],
          ]),
        },
      ],
      rules: [],
    };
    vi.mocked(listPendingActions).mockResolvedValue([
      {
        actionId: "action-3",
        proposerId: "member-a",
        eventName: "Token: burn",
        params: {
          kind: "burn",
          amount: 2n,
          burnFromId: "member-a",
          publicNote: "burn note",
        },
      },
    ]);
    vi.mocked(listActionSigners).mockResolvedValue({
      signers: new Map(),
      signedPower: 0n,
      requiredPower: 3,
      hasSigned: () => false,
    });
    vi.mocked(burnToken).mockResolvedValue({});

    renderPending(governance);

    fireEvent.click(
      await screen.findByRole("button", { name: "Add your signature" }),
    );
    expect(burnToken).not.toHaveBeenCalled();
    expect(screen.getByText("Confirm signature for burn")).toBeTruthy();
    expect(
      screen.getByText(/destructive if it later reaches threshold/i),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add your signature" }));

    await waitFor(() =>
      expect(burnToken).toHaveBeenCalledWith(
        expect.objectContaining({
          contractId: "contract-1",
          actionId: "action-3",
          groupPosition: 0,
          amount: 2n,
          publicNote: "burn note",
        }),
      ),
    );
  });

  it("collapses proposals whose capability is assigned to another group", async () => {
    vi.mocked(useSession).mockReturnValue({
      status: "authenticated",
      sdk: {},
      keyManager: { id: "key-manager" },
      contractId: "contract-1",
      identityId: "member-b",
      log: vi.fn(),
    } as never);
    const governance: TokenOpsGovernance = {
      groups: [
        {
          groupPosition: 0,
          requiredPower: 2,
          members: new Map([
            ["member-a", 1],
            ["member-b", 1],
          ]),
        },
        {
          groupPosition: 1,
          requiredPower: 2,
          members: new Map([
            ["member-c", 1],
            ["member-d", 1],
          ]),
        },
      ],
      rules: [
        {
          key: "manualMinting",
          label: "Manual minting",
          ruleName: "manualMintingRules",
          operator: { type: "Group", groupPosition: 1 },
          admin: { type: "ContractOwner" },
          canSetOperatorToNoOne: false,
          canSetAdminToNoOne: false,
          supportsGroupAction: true,
        },
      ],
    };
    vi.mocked(listPendingActions).mockImplementation(
      async ({ groupPosition }) =>
        groupPosition === 0
          ? [
              {
                actionId: "stranded-action",
                proposerId: "member-a",
                eventName: "Token: mint",
                params: {
                  kind: "mint",
                  amount: 3n,
                  recipientId: "recipient-1",
                },
              },
            ]
          : [],
    );
    vi.mocked(listActionSigners).mockResolvedValue({
      signers: new Map([["member-a", 1n]]),
      signedPower: 1n,
      requiredPower: 2,
      hasSigned: (identityId: string) => identityId === "member-a",
    });

    const refreshGovernance = vi.fn();
    renderPending(governance, refreshGovernance);

    const summary = await screen.findByText("Not currently actionable");
    const section = summary.closest("details") as HTMLDetailsElement;
    expect(section.open).toBe(false);
    expect(screen.getByText("Show proposals")).toBeTruthy();
    expect(
      screen.getByText(
        /groups that are no longer authorized to approve the requested action/i,
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Sign & execute mint" }),
    ).toBeNull();

    fireEvent.click(summary);

    expect(section.open).toBe(true);
    expect(screen.getByText("Hide proposals")).toBeTruthy();
    expect(
      screen.getByText(
        /currently assigned to Group 1.*proposal belongs to Group 0/i,
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Sign & execute mint" }),
    ).toBeNull();
    expect(mintToken).not.toHaveBeenCalled();

    const refreshedGovernance: TokenOpsGovernance = {
      groups: [
        {
          groupPosition: 0,
          requiredPower: 2,
          members: new Map([
            ["member-a", 1],
            ["member-b", 1],
          ]),
        },
        {
          groupPosition: 1,
          requiredPower: 2,
          members: new Map([
            ["member-c", 1],
            ["member-d", 1],
          ]),
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
    };
    refreshGovernance.mockResolvedValue(refreshedGovernance);
    const pendingLoadsBeforeRefresh =
      vi.mocked(listPendingActions).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(
      await screen.findByRole("button", { name: "Sign & execute mint" }),
    ).toBeTruthy();
    expect(screen.queryByText("Not currently actionable")).toBeNull();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(listPendingActions).toHaveBeenCalledTimes(
      pendingLoadsBeforeRefresh + refreshedGovernance.groups.length,
    );
  });
});
