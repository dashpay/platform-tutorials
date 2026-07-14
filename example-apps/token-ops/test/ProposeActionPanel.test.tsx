// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProposeActionPanel } from "../src/components/ProposeActionPanel";
import {
  burnToken,
  destroyFrozenToken,
  emergencyTokenAction,
  transferToken,
} from "../src/dash/tokenOperations";
import type { RuleInfo, TokenOpsGovernance } from "../src/dash/governance";
import { useSession } from "../src/session/useSession";

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
      members: new Map([
        ["treasury-member", 1],
        ["treasury-member-2", 1],
        ["treasury-member-3", 1],
      ]),
      requiredPower: 2,
    },
    {
      groupPosition: 1,
      members: new Map([
        ["access-member", 1],
        ["access-member-2", 1],
        ["access-member-3", 1],
      ]),
      requiredPower: 2,
    },
    {
      groupPosition: 2,
      members: new Map([
        ["emergency-member", 1],
        ["emergency-member-2", 1],
        ["emergency-member-3", 1],
      ]),
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
    members: new Map([
      ["operator-member", 1],
      ["operator-member-2", 1],
      ["operator-member-3", 1],
    ]),
  })),
  rules: governance.rules,
};

describe("ProposeActionPanel", () => {
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
    render(<ProposeActionPanel governance={governance} />);

    await waitFor(() =>
      expect(
        screen.getByText(/You can propose for Group 1 · Access/i),
      ).toBeTruthy(),
    );

    const mintSelector = screen.getByRole("tab", { name: "Mint" });
    const freezeSelector = screen.getByRole("tab", { name: "Freeze" });
    expect(mintSelector.getAttribute("aria-disabled")).toBe("true");
    expect(mintSelector.title).toBe(
      "Requires membership in Group 0 · Treasury.",
    );
    expect(freezeSelector.getAttribute("aria-disabled")).toBe("false");

    const mint = screen.getByRole("button", {
      name: /Propose mint/,
    }) as HTMLButtonElement;
    fireEvent.click(screen.getByRole("tab", { name: "Transfer" }));
    fireEvent.change(screen.getByLabelText("Transfer recipient identity ID"), {
      target: { value: "recipient-id" },
    });
    const transfer = screen.getByRole("button", {
      name: /Transfer/,
    }) as HTMLButtonElement;
    fireEvent.click(screen.getByRole("tab", { name: "Freeze" }));
    fireEvent.change(screen.getByLabelText("Freeze target identity ID"), {
      target: { value: "target-id" },
    });
    const freeze = screen.getByRole("button", {
      name: /Propose freeze/,
    }) as HTMLButtonElement;
    const destroyFrozenSelector = screen.getByRole("tab", {
      name: "Destroy frozen",
    });

    expect(mint.title).toBe("Requires membership in Group 0 · Treasury.");
    expect(destroyFrozenSelector.getAttribute("aria-disabled")).toBe("true");
    expect(destroyFrozenSelector.title).toBe(
      "Requires membership in Group 2 · Access + Emergency.",
    );
    expect(screen.queryByRole("button", { name: /Propose burn/ })).toBeNull();
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
    render(<ProposeActionPanel governance={governance} />);

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
    render(<ProposeActionPanel governance={governance} />);

    await waitFor(() =>
      expect(
        screen.getByText(
          "Explore supported token actions and their approval requirements.",
        ),
      ).toBeTruthy(),
    );

    expect(screen.getAllByText(/Sign in/i)).toHaveLength(1);

    const mint = screen.getByRole("button", {
      name: /Propose mint/,
    }) as HTMLButtonElement;
    expect(screen.queryByLabelText("Freeze target identity ID")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Freeze" }));
    const freeze = screen.getByRole("button", {
      name: /Propose freeze/,
    }) as HTMLButtonElement;
    fireEvent.click(screen.getByRole("tab", { name: "Transfer" }));
    fireEvent.change(screen.getByLabelText("Transfer recipient identity ID"), {
      target: { value: "recipient-id" },
    });
    const transfer = screen.getByRole("button", {
      name: /Transfer/,
    }) as HTMLButtonElement;

    expect(mint.disabled).toBe(true);
    expect(mint.title).toBe("Sign in to propose this action.");
    expect(freeze.disabled).toBe(true);
    expect(freeze.title).toBe("Sign in to propose this action.");
    expect(transfer.disabled).toBe(true);
    expect(transfer.title).toBe("Sign in to transfer tokens.");
    expect(screen.queryByText("No group operation permissions")).toBeNull();
  });

  it("shows only the fields relevant to the selected proposal type", async () => {
    vi.mocked(useSession).mockReturnValue({
      status: "authenticated",
      sdk: { contracts: {} },
      keyManager: {},
      contractId: "contract-1",
      identityId: "operator-member",
      log: vi.fn(),
    } as never);
    render(<ProposeActionPanel governance={allMemberGovernance} />);

    await screen.findByLabelText("Mint amount");
    expect(screen.getByLabelText("Mint recipient identity ID")).toBeTruthy();
    expect(screen.queryByLabelText("Freeze target identity ID")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Unfreeze" }));
    expect(screen.getByLabelText("Unfreeze target identity ID")).toBeTruthy();
    expect(screen.queryByLabelText("Mint amount")).toBeNull();
    expect(
      screen.getByRole("button", { name: /Propose unfreeze/ }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Resume" }));
    expect(screen.getByRole("button", { name: /Propose resume/ })).toBeTruthy();
    expect(screen.queryByLabelText("Unfreeze target identity ID")).toBeNull();
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
    vi.mocked(burnToken).mockResolvedValue({});

    render(<ProposeActionPanel governance={allMemberGovernance} />);

    await screen.findByRole("tab", { name: "Burn" });
    fireEvent.click(screen.getByRole("tab", { name: "Burn" }));
    fireEvent.change(screen.getByLabelText("Burn amount"), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Propose burn/ }));

    expect(burnToken).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Burning is irreversible and submits an on-chain group action.",
      ),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText("Burn amount") as HTMLInputElement).value,
    ).toBe("7");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: /Propose burn/ })).toBeTruthy();
    expect(
      (screen.getByLabelText("Burn amount") as HTMLInputElement).value,
    ).toBe("7");

    fireEvent.click(screen.getByRole("button", { name: /Propose burn/ }));
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
    vi.mocked(destroyFrozenToken).mockResolvedValue({});
    vi.mocked(emergencyTokenAction).mockResolvedValue({});

    render(<ProposeActionPanel governance={allMemberGovernance} />);

    await screen.findByRole("tab", { name: "Destroy frozen" });
    fireEvent.click(screen.getByRole("tab", { name: "Destroy frozen" }));
    await screen.findByRole("button", { name: /Propose destroy frozen/ });
    fireEvent.change(
      screen.getByLabelText("Destroy frozen target identity ID"),
      {
        target: { value: "target-id" },
      },
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Propose destroy frozen/ }),
    );
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

    fireEvent.click(screen.getByRole("tab", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: /Propose pause/ }));
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

    fireEvent.click(screen.getByRole("tab", { name: "Resume" }));
    fireEvent.click(screen.getByRole("button", { name: /Propose resume/ }));
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

  it("surfaces the app's current whole-base-unit input limitation", async () => {
    // This documents a TokenOps UI limitation, not a Dash token invariant.
    // Tokens may define decimal places, but this view currently accepts raw
    // integer base units and does not yet convert decimal display amounts.
    vi.mocked(useSession).mockReturnValue({
      status: "authenticated",
      sdk: { contracts: {} },
      keyManager: {},
      contractId: "contract-1",
      identityId: "operator-member",
      log: vi.fn(),
    } as never);
    render(<ProposeActionPanel governance={allMemberGovernance} />);

    await screen.findByRole("tab", { name: "Transfer" });
    fireEvent.click(screen.getByRole("tab", { name: "Transfer" }));
    fireEvent.change(screen.getByLabelText("Transfer amount"), {
      target: { value: "1.5" },
    });
    fireEvent.change(screen.getByLabelText("Transfer recipient identity ID"), {
      target: { value: "recipient-id" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Transfer/ }));

    expect(
      await screen.findByText("Amount must be a whole number."),
    ).toBeTruthy();
    expect(transferToken).not.toHaveBeenCalled();
  });

  it("submits a direct transfer with normalized inputs", async () => {
    const log = vi.fn();
    const onComplete = vi.fn();
    const sdk = { contracts: {} };
    const keyManager = {};
    vi.mocked(useSession).mockReturnValue({
      status: "authenticated",
      sdk,
      keyManager,
      contractId: "contract-1",
      identityId: "operator-member",
      log,
    } as never);
    vi.mocked(transferToken).mockResolvedValue({} as never);

    render(
      <ProposeActionPanel
        governance={allMemberGovernance}
        onComplete={onComplete}
      />,
    );

    await screen.findByRole("tab", { name: "Transfer" });
    fireEvent.click(screen.getByRole("tab", { name: "Transfer" }));
    fireEvent.change(screen.getByLabelText("Transfer amount"), {
      target: { value: " 8 " },
    });
    fireEvent.change(screen.getByLabelText("Transfer recipient identity ID"), {
      target: { value: "  recipient-id  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /Transfer/ }));

    await waitFor(() =>
      expect(transferToken).toHaveBeenCalledWith({
        sdk,
        keyManager,
        contractId: "contract-1",
        log,
        amount: 8n,
        recipientId: "recipient-id",
      }),
    );
    expect(log).toHaveBeenCalledWith("Transfer submitted.", "success");
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
