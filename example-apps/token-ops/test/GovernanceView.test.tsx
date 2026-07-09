// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GovernanceView } from "../src/components/GovernanceView";
import { fetchTokenOpsGovernance } from "../src/dash/governance";
import type { RuleInfo, TokenOpsGovernance } from "../src/dash/governance";
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

describe("GovernanceView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("summarizes membership, capabilities, and empty-group consequences", async () => {
    const governance: TokenOpsGovernance = {
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
    };

    vi.mocked(useSession).mockReturnValue({
      status: "authenticated",
      sdk: { contracts: {} },
      keyManager: {},
      contractId: "contract-1",
      identityId: "member-a",
      log: vi.fn(),
    } as never);
    vi.mocked(fetchTokenOpsGovernance).mockResolvedValue(governance);

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
    expect(
      screen.queryByRole("heading", { name: "Capabilities" }),
    ).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "Group 1" })[0]);
    expect(screen.getByText("Search")).toBeTruthy();
    expect(screen.getByText("Groups I'm in")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Group 3/ }));
    expect(
      screen.getByText(/Members can't perform any governed action yet/),
    ).toBeTruthy();
  });
});
