// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GovernanceView } from "../src/components/GovernanceView";
import {
  appendTokenOpsGroup,
  fetchTokenOpsGovernance,
} from "../src/dash/governance";
import type { RuleInfo, TokenOpsGovernance } from "../src/dash/governance";
import { assignTokenFunctionGroup } from "../src/dash/tokenOperations";
import { useSession } from "../src/session/useSession";

vi.mock("../src/dash/governance", () => ({
  appendTokenOpsGroup: vi.fn(),
  fetchTokenOpsGovernance: vi.fn(),
}));

vi.mock("../src/dash/tokenOperations", () => ({
  assignTokenFunctionGroup: vi.fn(),
}));

vi.mock("../src/session/useSession", () => ({
  useSession: vi.fn(),
}));

function groupRule(key: string, groupPosition: number): RuleInfo {
  return {
    key,
    label: key,
    ruleName: `${key}Rules`,
    operator: { type: "Group", groupPosition },
    admin: { type: "ContractOwner" },
    canSetOperatorToNoOne: false,
    canSetAdminToNoOne: false,
    supportsGroupAction: true,
  };
}

function authenticatedSession(identityId = "member-a") {
  return {
    status: "authenticated",
    sdk: { contracts: {} },
    keyManager: {
      getAuth: vi.fn().mockResolvedValue({
        identityKey: { id: "identity-key" },
        signer: { id: "signer" },
      }),
    },
    contractId: "contract-1",
    identityId,
    log: vi.fn(),
  };
}

function governance(
  value: Omit<TokenOpsGovernance, "contractOwnerId">,
  contractOwnerId = "member-a",
): TokenOpsGovernance {
  return { ...value, contractOwnerId };
}

describe("GovernanceView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("hides identity standing when signed out", async () => {
    vi.mocked(useSession).mockReturnValue({
      status: "readonly",
      sdk: { contracts: {} },
      keyManager: null,
      contractId: "contract-1",
      identityId: null,
      log: vi.fn(),
    } as never);
    vi.mocked(fetchTokenOpsGovernance).mockResolvedValue(
      governance({
        groups: [],
        rules: [],
      }),
    );

    render(<GovernanceView />);

    await waitFor(() => expect(fetchTokenOpsGovernance).toHaveBeenCalledOnce());
    expect(screen.queryByText("Your standing")).toBeNull();
    expect(
      screen.queryByText("Sign in to see which groups include this identity."),
    ).toBeNull();
  });

  it("lets signed-out visitors inspect reassignment without submitting", async () => {
    vi.mocked(useSession).mockReturnValue({
      status: "readonly",
      sdk: { contracts: {} },
      keyManager: null,
      contractId: "contract-1",
      identityId: null,
      log: vi.fn(),
    } as never);
    vi.mocked(fetchTokenOpsGovernance).mockResolvedValue(
      governance({
        groups: [
          {
            groupPosition: 1,
            members: new Map([["member-a", 1]]),
            requiredPower: 1,
          },
        ],
        rules: [groupRule("freeze", 1)],
      }),
    );

    render(<GovernanceView />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    expect(
      screen.getByText(
        /must sign in with an identity that has admin authority/,
      ),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Confirm reassignment",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("summarizes membership, capabilities, and empty-group consequences", async () => {
    const governanceSnapshot = governance({
      groups: [
        {
          groupPosition: 1,
          members: new Map([["member-a", 1]]),
          requiredPower: 2,
        },
        {
          groupPosition: 2,
          members: new Map([["member-b", 1]]),
          requiredPower: 3,
        },
        {
          groupPosition: 3,
          members: new Map([["member-a", 1]]),
          requiredPower: 1,
        },
      ],
      rules: [
        groupRule("freeze", 1),
        groupRule("unfreeze", 1),
        groupRule("destroyFrozenFunds", 2),
        groupRule("emergencyAction", 2),
        {
          ...groupRule("maxSupply", 2),
          deferred: true,
        },
      ],
    });

    vi.mocked(useSession).mockReturnValue({
      status: "authenticated",
      sdk: { contracts: {} },
      keyManager: {},
      contractId: "contract-1",
      identityId: "member-a",
      log: vi.fn(),
    } as never);
    vi.mocked(fetchTokenOpsGovernance).mockResolvedValue(governanceSnapshot);

    render(<GovernanceView />);

    await waitFor(() =>
      expect(screen.getByText("Member of Group 1, Group 3.")).toBeTruthy(),
    );

    expect(screen.getAllByText("Member")).toHaveLength(2);
    expect(
      screen.getByRole("heading", { name: "Capability authority", level: 4 }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Config authority", level: 4 }),
    ).toBeTruthy();
    expect(screen.getByText("maxSupply")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Capabilities" })).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "Group 1" })[0]);
    expect(screen.getByText("Search")).toBeTruthy();
    expect(screen.getByText("Groups I'm in")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Group 3/ }));
    expect(
      screen.getByText(/Members can't perform any governed action yet/),
    ).toBeTruthy();
  });

  it("reassigns a capability to a different group and refreshes governance", async () => {
    const governanceSnapshot = governance({
      groups: [
        {
          groupPosition: 1,
          members: new Map([["member-a", 1]]),
          requiredPower: 1,
        },
        {
          groupPosition: 2,
          members: new Map([["member-b", 1]]),
          requiredPower: 1,
        },
      ],
      rules: [groupRule("freeze", 1)],
    });
    const session = authenticatedSession();
    vi.mocked(useSession).mockReturnValue(session as never);
    vi.mocked(fetchTokenOpsGovernance).mockResolvedValue(governanceSnapshot);
    vi.mocked(assignTokenFunctionGroup).mockResolvedValue({} as never);

    render(<GovernanceView />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const confirm = screen.getByRole("button", {
      name: "Confirm reassignment",
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(
      screen.getByText("Choose a different group to reassign this capability."),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("New operator group"), {
      target: { value: "2" },
    });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(assignTokenFunctionGroup).toHaveBeenCalledWith({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId: "contract-1",
        ownerId: "member-a",
        ruleKind: "freeze",
        groupPosition: 2,
        log: session.log,
      }),
    );
    await waitFor(() =>
      expect(fetchTokenOpsGovernance).toHaveBeenCalledTimes(2),
    );
  });

  it("appends a group with parsed members and refreshes governance", async () => {
    const governanceSnapshot = governance({ groups: [], rules: [] });
    const session = authenticatedSession();
    vi.mocked(useSession).mockReturnValue(session as never);
    vi.mocked(fetchTokenOpsGovernance).mockResolvedValue(governanceSnapshot);
    vi.mocked(appendTokenOpsGroup).mockResolvedValue({} as never);

    render(<GovernanceView />);
    fireEvent.click(await screen.findByRole("tab", { name: "Groups" }));
    fireEvent.change(screen.getByLabelText("Member identity IDs"), {
      target: { value: "member-b, member-c\nmember-d" },
    });
    fireEvent.change(screen.getByLabelText("Required power"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Append group" }));

    await waitFor(() =>
      expect(appendTokenOpsGroup).toHaveBeenCalledWith({
        sdk: session.sdk,
        contractId: "contract-1",
        memberIds: ["member-b", "member-c", "member-d"],
        requiredPower: 2,
        identityKey: { id: "identity-key" },
        signer: { id: "signer" },
        log: session.log,
      }),
    );
    expect(session.keyManager.getAuth).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(fetchTokenOpsGovernance).toHaveBeenCalledTimes(2),
    );
  });

  it("blocks a second append while the first submission is in flight", async () => {
    const governanceSnapshot = governance({ groups: [], rules: [] });
    const session = authenticatedSession();
    vi.mocked(useSession).mockReturnValue(session as never);
    vi.mocked(fetchTokenOpsGovernance).mockResolvedValue(governanceSnapshot);

    let resolveAppend: ((value: unknown) => void) | undefined;
    vi.mocked(appendTokenOpsGroup).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAppend = resolve;
        }),
    );

    render(<GovernanceView />);
    fireEvent.click(await screen.findByRole("tab", { name: "Groups" }));
    fireEvent.change(screen.getByLabelText("Member identity IDs"), {
      target: { value: "member-b member-c" },
    });
    fireEvent.change(screen.getByLabelText("Required power"), {
      target: { value: "2" },
    });

    const form = screen
      .getByRole("button", { name: "Append group" })
      .closest("form")!;
    // Dispatch both submits immediately, before any waitFor/rerender. A
    // state-only mutex would let both pass and produce two getAuth /
    // appendTokenOpsGroup calls; the ref mutex must keep each at one.
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => {
      expect(session.keyManager.getAuth).toHaveBeenCalledOnce();
      expect(appendTokenOpsGroup).toHaveBeenCalledOnce();
    });

    expect(screen.getByRole("button", { name: "Appending..." })).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Appending...",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Member identity IDs") as HTMLTextAreaElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Required power") as HTMLInputElement).disabled,
    ).toBe(true);

    // Still only one in-flight operation after the UI has reflected busy state.
    fireEvent.submit(
      screen.getByRole("button", { name: "Appending..." }).closest("form")!,
    );
    expect(session.keyManager.getAuth).toHaveBeenCalledOnce();
    expect(appendTokenOpsGroup).toHaveBeenCalledOnce();

    resolveAppend?.({});
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Append group" })).toBeTruthy(),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Append group",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("surfaces append-group validation errors", async () => {
    const session = authenticatedSession();
    vi.mocked(useSession).mockReturnValue(session as never);
    vi.mocked(fetchTokenOpsGovernance).mockResolvedValue(
      governance({
        groups: [],
        rules: [],
      }),
    );
    vi.mocked(appendTokenOpsGroup).mockRejectedValue(
      new Error("TokenOps groups need 2-256 members, got 0"),
    );

    render(<GovernanceView />);
    fireEvent.click(await screen.findByRole("tab", { name: "Groups" }));
    fireEvent.click(screen.getByRole("button", { name: "Append group" }));

    expect(
      await screen.findByText("TokenOps groups need 2-256 members, got 0"),
    ).toBeTruthy();
    expect(fetchTokenOpsGovernance).toHaveBeenCalledOnce();
  });

  it("filters, searches, and sorts the group list", async () => {
    vi.mocked(useSession).mockReturnValue(
      authenticatedSession("member-a") as never,
    );
    vi.mocked(fetchTokenOpsGovernance).mockResolvedValue(
      governance({
        groups: [
          {
            groupPosition: 3,
            members: new Map([
              ["member-a", 1],
              ["member-c", 1],
            ]),
            requiredPower: 1,
          },
          {
            groupPosition: 1,
            members: new Map([["member-b", 1]]),
            requiredPower: 1,
          },
          {
            groupPosition: 2,
            members: new Map([
              ["member-d", 1],
              ["member-e", 1],
              ["member-f", 1],
            ]),
            requiredPower: 3,
          },
        ],
        rules: [groupRule("freeze", 1), groupRule("unfreeze", 1)],
      }),
    );

    render(<GovernanceView />);
    fireEvent.click(await screen.findByRole("tab", { name: "Groups" }));

    const visiblePositions = () =>
      [...document.querySelectorAll(".group-row-identity strong")].map(
        (element) => element.textContent,
      );
    expect(visiblePositions()).toEqual(["Group 1", "Group 2", "Group 3"]);

    fireEvent.change(screen.getByLabelText("Filter"), {
      target: { value: "mine" },
    });
    expect(visiblePositions()).toEqual(["Group 3"]);

    fireEvent.change(screen.getByLabelText("Filter"), {
      target: { value: "unused" },
    });
    expect(visiblePositions()).toEqual(["Group 2", "Group 3"]);

    fireEvent.change(screen.getByLabelText("Filter"), {
      target: { value: "all" },
    });
    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "member-e" },
    });
    expect(visiblePositions()).toEqual(["Group 2"]);

    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "freeze" },
    });
    expect(visiblePositions()).toEqual(["Group 1"]);

    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Sort"), {
      target: { value: "members" },
    });
    expect(visiblePositions()).toEqual(["Group 2", "Group 3", "Group 1"]);
  });

  it("shows governance changes read-only to an identity without authority", async () => {
    vi.mocked(useSession).mockReturnValue(
      authenticatedSession("member-b") as never,
    );
    vi.mocked(fetchTokenOpsGovernance).mockResolvedValue(
      governance({
        groups: [
          {
            groupPosition: 1,
            members: new Map([["member-b", 1]]),
            requiredPower: 1,
          },
        ],
        rules: [groupRule("freeze", 1)],
      }),
    );

    render(<GovernanceView />);

    await screen.findByText("freeze");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(
      screen.getByText(/does not have the admin authority required/),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Confirm reassignment",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(screen.getByRole("tab", { name: "Groups" }));
    expect(screen.getByText(/only the contract owner can append/)).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Append group",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("disables group-admin reassignment until propose/co-sign is supported", async () => {
    vi.mocked(useSession).mockReturnValue(
      authenticatedSession("member-b") as never,
    );
    vi.mocked(fetchTokenOpsGovernance).mockResolvedValue(
      governance(
        {
          groups: [
            {
              groupPosition: 1,
              members: new Map([
                ["member-b", 1],
                ["member-c", 1],
              ]),
              requiredPower: 2,
            },
            {
              groupPosition: 2,
              members: new Map([["member-d", 1]]),
              requiredPower: 1,
            },
          ],
          rules: [
            {
              ...groupRule("freeze", 1),
              admin: { type: "Group", groupPosition: 1 },
            },
          ],
        },
        "owner-1",
      ),
    );

    render(<GovernanceView />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("New operator group"), {
      target: { value: "2" },
    });
    expect(
      screen.getByText(/group-admin reassignment is not supported yet/),
    ).toBeTruthy();
    const confirm = screen.getByRole("button", {
      name: "Confirm reassignment",
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(assignTokenFunctionGroup).not.toHaveBeenCalled();
  });

  it("still lets a ContractOwner admin submit a direct reassignment", async () => {
    const session = authenticatedSession("owner-1");
    vi.mocked(useSession).mockReturnValue(session as never);
    vi.mocked(fetchTokenOpsGovernance).mockResolvedValue(
      governance(
        {
          groups: [
            {
              groupPosition: 1,
              members: new Map([["member-a", 1]]),
              requiredPower: 1,
            },
            {
              groupPosition: 2,
              members: new Map([["member-b", 1]]),
              requiredPower: 1,
            },
          ],
          rules: [groupRule("freeze", 1)],
        },
        "owner-1",
      ),
    );
    vi.mocked(assignTokenFunctionGroup).mockResolvedValue({} as never);

    render(<GovernanceView />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("New operator group"), {
      target: { value: "2" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm reassignment" }),
    );

    await waitFor(() =>
      expect(assignTokenFunctionGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: "owner-1",
          ruleKind: "freeze",
          groupPosition: 2,
        }),
      ),
    );
  });
});
