import { describe, expect, it, vi } from "vitest";

vi.mock("@dashevo/evo-sdk", () => ({
  AuthorizedActionTakers: {
    Group: (position: number) => ({ type: "Group", position }),
  },
  GroupStateTransitionInfoStatus: {
    proposer: (groupContractPosition: number) => ({
      kind: "proposer",
      groupContractPosition,
    }),
    otherSigner: (groupContractPosition: number, actionId: string) => ({
      kind: "otherSigner",
      groupContractPosition,
      actionId,
    }),
  },
  TokenConfigurationChangeItem: {
    ManualMintingItem: (actionTaker: unknown) => ({
      item: "ManualMinting",
      actionTaker,
    }),
    ManualBurningItem: (actionTaker: unknown) => ({
      item: "ManualBurning",
      actionTaker,
    }),
    FreezeItem: (actionTaker: unknown) => ({ item: "Freeze", actionTaker }),
    UnfreezeItem: (actionTaker: unknown) => ({ item: "Unfreeze", actionTaker }),
    DestroyFrozenFundsItem: (actionTaker: unknown) => ({
      item: "DestroyFrozenFunds",
      actionTaker,
    }),
    EmergencyActionItem: (actionTaker: unknown) => ({
      item: "EmergencyAction",
      actionTaker,
    }),
  },
}));

const identity = { id: { toString: () => "member-a" } };
const identityKey = { id: "key-1" };
const signer = { id: "signer-1" };

function makeKeyManager() {
  return {
    async getAuth() {
      return { identity, identityKey, signer };
    },
  } as never;
}

describe("group-managed token operations", () => {
  it("proposes mint with groupInfo when no actionId is provided", async () => {
    const { mintToken } = await import("../src/dash/tokenOperations");
    const mint = vi.fn().mockResolvedValue({ groupPower: 1 });

    await mintToken({
      sdk: { tokens: { mint } } as never,
      keyManager: makeKeyManager(),
      contractId: "contract-1",
      groupPosition: 2,
      amount: 5n,
    });

    expect(mint).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: "member-a",
        amount: 5n,
        groupInfo: { kind: "proposer", groupContractPosition: 2 },
      }),
    );
  });

  it("co-signs freeze with groupInfo when actionId is provided", async () => {
    const { freezeToken } = await import("../src/dash/tokenOperations");
    const freeze = vi.fn().mockResolvedValue({ document: {} });

    await freezeToken({
      sdk: { tokens: { freeze } } as never,
      keyManager: makeKeyManager(),
      contractId: "contract-1",
      groupPosition: 1,
      targetIdentityId: "target-1",
      actionId: "action-1",
      publicNote: "original proposer note",
    });

    expect(freeze).toHaveBeenCalledWith(
      expect.objectContaining({
        authorityId: "member-a",
        frozenIdentityId: "target-1",
        publicNote: undefined,
        groupInfo: {
          kind: "otherSigner",
          groupContractPosition: 1,
          actionId: "action-1",
        },
      }),
    );
  });

  it("burns from the signer identity when proposing a group burn", async () => {
    const { burnToken } = await import("../src/dash/tokenOperations");
    const burn = vi.fn().mockResolvedValue({ groupPower: 1 });

    await burnToken({
      sdk: { tokens: { burn } } as never,
      keyManager: makeKeyManager(),
      contractId: "contract-1",
      groupPosition: 0,
      amount: 2n,
    });

    expect(burn).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: "member-a",
        amount: 2n,
        groupInfo: { kind: "proposer", groupContractPosition: 0 },
      }),
    );
  });

  it("proposes unfreeze against the trimmed target with proposer groupInfo", async () => {
    const { unfreezeToken } = await import("../src/dash/tokenOperations");
    const unfreeze = vi.fn().mockResolvedValue({});

    await unfreezeToken({
      sdk: { tokens: { unfreeze } } as never,
      keyManager: makeKeyManager(),
      contractId: "contract-1",
      groupPosition: 1,
      targetIdentityId: "  target-2  ",
    });

    expect(unfreeze).toHaveBeenCalledWith(
      expect.objectContaining({
        authorityId: "member-a",
        frozenIdentityId: "target-2",
        groupInfo: { kind: "proposer", groupContractPosition: 1 },
      }),
    );
  });

  it("co-signs destroyFrozen with otherSigner groupInfo", async () => {
    const { destroyFrozenToken } = await import("../src/dash/tokenOperations");
    const destroyFrozen = vi.fn().mockResolvedValue({});

    await destroyFrozenToken({
      sdk: { tokens: { destroyFrozen } } as never,
      keyManager: makeKeyManager(),
      contractId: "contract-1",
      groupPosition: 2,
      targetIdentityId: "target-3",
      actionId: "action-9",
    });

    expect(destroyFrozen).toHaveBeenCalledWith(
      expect.objectContaining({
        authorityId: "member-a",
        frozenIdentityId: "target-3",
        groupInfo: {
          kind: "otherSigner",
          groupContractPosition: 2,
          actionId: "action-9",
        },
      }),
    );
  });

  it("forwards the pause/resume action for an emergency proposal", async () => {
    const { emergencyTokenAction } =
      await import("../src/dash/tokenOperations");
    const emergencyAction = vi.fn().mockResolvedValue({});

    await emergencyTokenAction({
      sdk: { tokens: { emergencyAction } } as never,
      keyManager: makeKeyManager(),
      contractId: "contract-1",
      groupPosition: 2,
      action: "pause",
    });

    expect(emergencyAction).toHaveBeenCalledWith(
      expect.objectContaining({
        authorityId: "member-a",
        action: "pause",
        groupInfo: { kind: "proposer", groupContractPosition: 2 },
      }),
    );
  });
});

describe("publicNote submission policy", () => {
  it("uses the fallback note when proposing without an explicit note", async () => {
    const { mintToken } = await import("../src/dash/tokenOperations");
    const mint = vi.fn().mockResolvedValue({ groupPower: 1 });

    await mintToken({
      sdk: { tokens: { mint } } as never,
      keyManager: makeKeyManager(),
      contractId: "contract-1",
      groupPosition: 0,
      amount: 1n,
    });

    expect(mint).toHaveBeenCalledWith(
      expect.objectContaining({ publicNote: "TokenOps mint" }),
    );
  });

  it("passes a provided note through when proposing", async () => {
    const { mintToken } = await import("../src/dash/tokenOperations");
    const mint = vi.fn().mockResolvedValue({ groupPower: 1 });

    await mintToken({
      sdk: { tokens: { mint } } as never,
      keyManager: makeKeyManager(),
      contractId: "contract-1",
      groupPosition: 0,
      amount: 1n,
      publicNote: "my note",
    });

    expect(mint).toHaveBeenCalledWith(
      expect.objectContaining({ publicNote: "my note" }),
    );
  });

  it("drops the note when co-signing so it matches the original proposer's", async () => {
    const { mintToken } = await import("../src/dash/tokenOperations");
    const mint = vi.fn().mockResolvedValue({ groupPower: 2 });

    await mintToken({
      sdk: { tokens: { mint } } as never,
      keyManager: makeKeyManager(),
      contractId: "contract-1",
      groupPosition: 0,
      amount: 1n,
      actionId: "action-1",
      publicNote: "co-signer would-be note",
    });

    expect(mint).toHaveBeenCalledWith(
      expect.objectContaining({ publicNote: undefined }),
    );
  });
});

describe("transferToken", () => {
  it("transfers from the signer with a trimmed recipient and no groupInfo", async () => {
    const { transferToken } = await import("../src/dash/tokenOperations");
    const transfer = vi.fn().mockResolvedValue({});

    await transferToken({
      sdk: { tokens: { transfer } } as never,
      keyManager: makeKeyManager(),
      contractId: "contract-1",
      amount: 4n,
      recipientId: "  recipient-1  ",
    });

    const args = transfer.mock.calls[0][0];
    expect(args).toEqual(
      expect.objectContaining({
        senderId: "member-a",
        recipientId: "recipient-1",
        amount: 4n,
      }),
    );
    // Transfer is the only direct (non-group) operation.
    expect(args).not.toHaveProperty("groupInfo");
  });
});

describe("configurationChangeItemForRule", () => {
  it("maps all six reassignable rule kinds to their config change items", async () => {
    const { configurationChangeItemForRule } =
      await import("../src/dash/tokenOperations");
    const cases = [
      ["manualMinting", "ManualMinting"],
      ["manualBurning", "ManualBurning"],
      ["freeze", "Freeze"],
      ["unfreeze", "Unfreeze"],
      ["destroyFrozenFunds", "DestroyFrozenFunds"],
      ["emergencyAction", "EmergencyAction"],
    ] as const;

    for (const [kind, item] of cases) {
      expect(await configurationChangeItemForRule(kind, 4)).toEqual({
        item,
        actionTaker: { type: "Group", position: 4 },
      });
    }
  });
});

describe("assignTokenFunctionGroup", () => {
  it("submits a configUpdate built from configurationChangeItemForRule", async () => {
    const { assignTokenFunctionGroup, configurationChangeItemForRule } =
      await import("../src/dash/tokenOperations");
    const configUpdate = vi.fn().mockResolvedValue({});

    await assignTokenFunctionGroup({
      sdk: { tokens: { configUpdate } } as never,
      keyManager: makeKeyManager(),
      contractId: "contract-1",
      ownerId: "owner-1",
      ruleKind: "freeze",
      groupPosition: 5,
    });

    expect(configUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: "owner-1",
        configurationChangeItem: await configurationChangeItemForRule(
          "freeze",
          5,
        ),
      }),
    );
  });
});
