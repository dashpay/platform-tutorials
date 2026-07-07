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
      expect(screen.getByText(/Member of Access Group/i)).toBeTruthy(),
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

    expect(screen.getByText("🔒 Requires membership in Treasury Group.")).toBeTruthy();
    expect(screen.getByText("🔒 Requires membership in Emergency Group.")).toBeTruthy();
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
});
