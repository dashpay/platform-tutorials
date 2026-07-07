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

  it("maps exposed reassignment rules to config update items", async () => {
    const { configurationChangeItemForRule } = await import(
      "../src/dash/tokenOperations"
    );

    expect(configurationChangeItemForRule("manualMinting", 4)).toEqual({
      item: "ManualMinting",
      actionTaker: { type: "Group", position: 4 },
    });
    expect(configurationChangeItemForRule("emergencyAction", 5)).toEqual({
      item: "EmergencyAction",
      actionTaker: { type: "Group", position: 5 },
    });
  });
});

describe("group action reads", () => {
  it("extracts co-sign parameters from pending token events", async () => {
    const { parsePendingTokenActionParams } = await import("../src/dash/groupActions");

    expect(
      parsePendingTokenActionParams({
        event: {
          tokenEvent: () => ({
            toJSON: () => ({
              type: "mint",
              data: ["7", "recipient-1", "note"],
            }),
          }),
        },
      }),
    ).toEqual({
      kind: "mint",
      amount: 7n,
      recipientId: "recipient-1",
      publicNote: "note",
    });

    expect(
      parsePendingTokenActionParams({
        toJSON: () => ({
          event: {
            data: {
              type: "emergencyAction",
              data: [1, null],
            },
          },
        }),
      }),
    ).toEqual({
      kind: "emergency",
      action: "resume",
      publicNote: undefined,
    });
  });

  it("includes ACTIVE status when reading action signers", async () => {
    const { listActionSigners } = await import("../src/dash/groupActions");
    const actionSigners = vi.fn().mockResolvedValue(new Map([["a", 1n]]));

    const progress = await listActionSigners({
      sdk: { group: { actionSigners } } as never,
      contractId: "contract-1",
      groupPosition: 3,
      actionId: "action-1",
      requiredPower: 2,
    });

    expect(actionSigners).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ACTIVE",
        groupContractPosition: 3,
        actionId: "action-1",
      }),
    );
    expect(progress.signedPower).toBe(1n);
  });
});
