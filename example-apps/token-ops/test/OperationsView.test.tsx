// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OperationsView } from "../src/components/OperationsView";
import { fetchTokenOpsGovernance } from "../src/dash/governance";
import {
  burnToken,
  destroyFrozenToken,
  emergencyTokenAction,
} from "../src/dash/tokenOperations";
import type { RuleInfo, TokenOpsGovernance } from "../src/dash/governance";
import { useSession } from "../src/session/useSession";

vi.mock("../src/dash/governance", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/dash/governance")>();
  return {
    ...actual,
    fetchTokenOpsGovernance: vi.fn(),
  };
});

vi.mock("../src/session/useSession", () => ({
  useSession: vi.fn(),
}));

vi.mock("../src/dash/tokenOperations", () => ({
  burnToken: vi.fn(),
  destroyFrozenToken: vi.fn(),
  emergencyTokenAction: vi.fn(),
  freezeToken: vi.fn(),
  mintToken: vi.fn(),
  transferToken: vi.fn(),
  unfreezeToken: vi.fn(),
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

const governance: TokenOpsGovernance = {
  groups: [
    {
      groupPosition: 0,
      members: new Map([["treasury-member", 1]]),
      requiredPower: 2,
    },
    {
      groupPosition: 1,
      members: new Map([["access-member", 1]]),
      requiredPower: 2,
    },
    {
      groupPosition: 2,
      members: new Map([["emergency-member", 1]]),
      requiredPower: 3,
    },
  ],
  rules: [
    groupRule("manualMinting", 0),
    groupRule("manualBurning", 0),
    groupRule("freeze", 1),
    groupRule("unfreeze", 1),
    groupRule("destroyFrozenFunds", 2),
    groupRule("emergencyAction", 2),
  ],
};

const allMemberGovernance: TokenOpsGovernance = {
  groups: governance.groups.map((group) => ({
    ...group,
    members: new Map([["operator-member", 1]]),
  })),
  rules: governance.rules,
};

describe("OperationsView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("disables group-managed operations when the signed-in identity is not in the operator group", async () => {
    vi.mocked(useSession).mockReturnValue({
      status: "authenticated",
      sdk: { contracts: {} },
      keyManager: {},
      contractId: "contract-1",
      identityId: "access-member",
      log: vi.fn(),
    } as never);
    vi.mocked(fetchTokenOpsGovernance).mockResolvedValue(governance);

    render(<OperationsView />);

    await waitFor(() =>
      expect(screen.getByText(/member of Group 1 · Access/i)).toBeTruthy(),
    );

    const transfer = screen.getByRole("button", {
      name: "Transfer",
    }) as HTMLButtonElement;
    const freeze = screen.getByRole("button", {
      name: "Propose freeze",
    }) as HTMLButtonElement;

    fireEvent.change(screen.getByLabelText("Transfer recipient identity ID"), {
      target: { value: "recipient-id" },
    });
    fireEvent.change(screen.getByLabelText("Access target identity ID"), {
      target: { value: "target-id" },
    });

    expect(
      screen.getByText("Requires membership in Group 0 · Treasury."),
    ).toBeTruthy();
    expect(
      screen.getByText("Requires membership in Group 2 · Access + Emergency."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Burn..." })).toBeNull();
    expect(screen.queryByRole("button", { name: "Propose pause" })).toBeNull();
    expect(transfer.disabled).toBe(false);
    expect(freeze.disabled).toBe(false);
  });

  it("shows a prominent warning when no group-managed operations are available", async () => {
    vi.mocked(useSession).mockReturnValue({
      status: "authenticated",
      sdk: { contracts: {} },
      keyManager: {},
      contractId: "contract-1",
      identityId: "non-member",
      log: vi.fn(),
    } as never);
    vi.mocked(fetchTokenOpsGovernance).mockResolvedValue(governance);

    render(<OperationsView />);

    await waitFor(() =>
      expect(screen.getByText("No group operation permissions")).toBeTruthy(),
    );

    expect(
      screen
        .getByText(/Group-managed actions are disabled/i)
        .closest(".notice.warning.prominent"),
    ).toBeTruthy();
  });

  it("shows supported operations in read-only mode with submit controls disabled", async () => {
    vi.mocked(useSession).mockReturnValue({
      status: "readonly",
      sdk: { contracts: {} },
      keyManager: null,
      contractId: "contract-1",
      identityId: null,
      log: vi.fn(),
    } as never);
    vi.mocked(fetchTokenOpsGovernance).mockResolvedValue(governance);

    render(<OperationsView />);

    await waitFor(() =>
      expect(screen.getByText(/submission controls are disabled/i)).toBeTruthy(),
    );

    expect(screen.getByText("Supply")).toBeTruthy();
    expect(screen.getByText("Access")).toBeTruthy();
    expect(screen.getByText("Emergency")).toBeTruthy();

    const mint = screen.getByRole("button", {
      name: "Propose mint",
    }) as HTMLButtonElement;
    const freeze = screen.getByRole("button", {
      name: "Propose freeze",
    }) as HTMLButtonElement;
    const transfer = screen.getByRole("button", {
      name: "Transfer",
    }) as HTMLButtonElement;

    fireEvent.change(screen.getByLabelText("Transfer recipient identity ID"), {
      target: { value: "recipient-id" },
    });

    expect(mint.disabled).toBe(true);
    expect(mint.title).toBe("Sign in to propose this action.");
    expect(freeze.disabled).toBe(true);
    expect(freeze.title).toBe("Sign in to propose this action.");
    expect(transfer.disabled).toBe(true);
    expect(transfer.title).toBe("Sign in to transfer tokens.");
    expect(screen.queryByText("No group operation permissions")).toBeNull();
  });

  it("gates burn with an inline confirmation panel", async () => {
    vi.mocked(useSession).mockReturnValue({
      status: "authenticated",
      sdk: { contracts: {} },
      keyManager: {},
      contractId: "contract-1",
      identityId: "operator-member",
      log: vi.fn(),
    } as never);
    vi.mocked(fetchTokenOpsGovernance).mockResolvedValue(allMemberGovernance);
    vi.mocked(burnToken).mockResolvedValue({});

    render(<OperationsView />);

    await screen.findByRole("button", { name: "Propose burn..." });
    fireEvent.change(screen.getByLabelText("Supply amount"), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Propose burn..." }));

    expect(burnToken).not.toHaveBeenCalled();
    expect(
      screen.getByText("Burning is irreversible and submits an on-chain group action."),
    ).toBeTruthy();
    expect((screen.getByLabelText("Supply amount") as HTMLInputElement).value).toBe(
      "7",
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Propose burn..." })).toBeTruthy();
    expect((screen.getByLabelText("Supply amount") as HTMLInputElement).value).toBe(
      "7",
    );

    fireEvent.click(screen.getByRole("button", { name: "Propose burn..." }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm burn" }));

    await waitFor(() =>
      expect(burnToken).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 7n,
          groupPosition: 0,
        }),
      ),
    );
  });

  it("gates destroy-frozen and emergency actions with inline confirmations", async () => {
    vi.mocked(useSession).mockReturnValue({
      status: "authenticated",
      sdk: { contracts: {} },
      keyManager: {},
      contractId: "contract-1",
      identityId: "operator-member",
      log: vi.fn(),
    } as never);
    vi.mocked(fetchTokenOpsGovernance).mockResolvedValue(allMemberGovernance);
    vi.mocked(destroyFrozenToken).mockResolvedValue({});
    vi.mocked(emergencyTokenAction).mockResolvedValue({});

    render(<OperationsView />);

    await screen.findByRole("button", { name: "Destroy frozen..." });
    fireEvent.change(screen.getByLabelText("Access target identity ID"), {
      target: { value: "target-id" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Destroy frozen..." }));
    expect(destroyFrozenToken).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm destroy" }));
    await waitFor(() =>
      expect(destroyFrozenToken).toHaveBeenCalledWith(
        expect.objectContaining({
          targetIdentityId: "target-id",
          groupPosition: 2,
        }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Propose pause" }));
    expect(
      (screen.getByRole("button", { name: "Propose resume" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(emergencyTokenAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm pause" }));
    await waitFor(() =>
      expect(emergencyTokenAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "pause",
          groupPosition: 2,
        }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Propose resume" }));
    expect(
      (screen.getByRole("button", { name: "Propose pause" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(emergencyTokenAction).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Confirm resume" }));
    await waitFor(() =>
      expect(emergencyTokenAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "resume",
          groupPosition: 2,
        }),
      ),
    );
  });
});
