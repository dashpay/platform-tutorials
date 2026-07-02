import { describe, expect, it, vi } from "vitest";

vi.mock("@dashevo/evo-sdk", () => ({
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
}));

const identity = { id: { toString: () => "panelist-a" } };
const identityKey = { id: "key-1" };
const signer = { id: "signer-1" };

function makeKeyManager() {
  return {
    async getAuth() {
      return { identity, identityKey, signer };
    },
  } as never;
}

describe("freezeCredit — propose vs co-sign branching", () => {
  it("proposes a new group action when no actionId is given", async () => {
    const { freezeCredit } = await import("../src/dash/freezeCredit");
    const freeze = vi.fn().mockResolvedValue({ groupPower: 1 });

    await freezeCredit({
      sdk: { tokens: { freeze } } as never,
      keyManager: makeKeyManager(),
      contractId: "contract-1",
      frozenIdentityId: "bad-actor-1",
    });

    expect(freeze).toHaveBeenCalledWith(
      expect.objectContaining({
        authorityId: "panelist-a",
        frozenIdentityId: "bad-actor-1",
        groupInfo: { kind: "proposer", groupContractPosition: 0 },
      }),
    );
  });

  it("co-signs an existing group action when actionId is given", async () => {
    const { freezeCredit } = await import("../src/dash/freezeCredit");
    const freeze = vi.fn().mockResolvedValue({ document: {} });

    await freezeCredit({
      sdk: { tokens: { freeze } } as never,
      keyManager: makeKeyManager(),
      contractId: "contract-1",
      frozenIdentityId: "bad-actor-1",
      actionId: "action-abc",
    });

    expect(freeze).toHaveBeenCalledWith(
      expect.objectContaining({
        groupInfo: {
          kind: "otherSigner",
          groupContractPosition: 0,
          actionId: "action-abc",
        },
      }),
    );
  });
});

describe("destroyFrozenCredit — propose vs co-sign branching", () => {
  it("proposes a new group action when no actionId is given", async () => {
    const { destroyFrozenCredit } =
      await import("../src/dash/destroyFrozenCredit");
    const destroyFrozen = vi.fn().mockResolvedValue({ groupPower: 1 });

    await destroyFrozenCredit({
      sdk: { tokens: { destroyFrozen } } as never,
      keyManager: makeKeyManager(),
      contractId: "contract-1",
      frozenIdentityId: "bad-actor-1",
    });

    expect(destroyFrozen).toHaveBeenCalledWith(
      expect.objectContaining({
        groupInfo: { kind: "proposer", groupContractPosition: 0 },
      }),
    );
  });

  it("co-signs an existing group action when actionId is given", async () => {
    const { destroyFrozenCredit } =
      await import("../src/dash/destroyFrozenCredit");
    const destroyFrozen = vi.fn().mockResolvedValue({ document: {} });

    await destroyFrozenCredit({
      sdk: { tokens: { destroyFrozen } } as never,
      keyManager: makeKeyManager(),
      contractId: "contract-1",
      frozenIdentityId: "bad-actor-1",
      actionId: "action-xyz",
    });

    expect(destroyFrozen).toHaveBeenCalledWith(
      expect.objectContaining({
        groupInfo: {
          kind: "otherSigner",
          groupContractPosition: 0,
          actionId: "action-xyz",
        },
      }),
    );
  });
});

describe("unfreezeCredit — propose vs co-sign branching", () => {
  it("proposes a new group action when no actionId is given", async () => {
    const { unfreezeCredit } = await import("../src/dash/unfreezeCredit");
    const unfreeze = vi.fn().mockResolvedValue({ groupPower: 1 });

    await unfreezeCredit({
      sdk: { tokens: { unfreeze } } as never,
      keyManager: makeKeyManager(),
      contractId: "contract-1",
      frozenIdentityId: "cleared-researcher-1",
    });

    expect(unfreeze).toHaveBeenCalledWith(
      expect.objectContaining({
        groupInfo: { kind: "proposer", groupContractPosition: 0 },
      }),
    );
  });

  it("co-signs an existing group action when actionId is given", async () => {
    const { unfreezeCredit } = await import("../src/dash/unfreezeCredit");
    const unfreeze = vi.fn().mockResolvedValue({ document: {} });

    await unfreezeCredit({
      sdk: { tokens: { unfreeze } } as never,
      keyManager: makeKeyManager(),
      contractId: "contract-1",
      frozenIdentityId: "cleared-researcher-1",
      actionId: "action-def",
    });

    expect(unfreeze).toHaveBeenCalledWith(
      expect.objectContaining({
        groupInfo: {
          kind: "otherSigner",
          groupContractPosition: 0,
          actionId: "action-def",
        },
      }),
    );
  });
});

describe("describeGroupAction", () => {
  it("maps token event names to human-readable labels", async () => {
    const { describeGroupAction } = await import("../src/dash/groupActions");
    expect(describeGroupAction("TokenFreeze")).toMatch(/freeze/i);
    expect(describeGroupAction("TokenUnfreeze")).toMatch(/unfreeze/i);
    expect(describeGroupAction("TokenDestroyFrozenFunds")).toMatch(
      /slash|destroy/i,
    );
  });
});

describe("listActionSigners", () => {
  // Regression test: sdk.group.actionSigners requires a `status` field
  // (GroupActionSignersQuery) — omitting it fails on-chain with "serde
  // deserialization error: missing field `status`". This was caught live
  // against testnet, not by an earlier version of this test.
  it("includes status: 'ACTIVE' in the query", async () => {
    const { listActionSigners } = await import("../src/dash/groupActions");
    const actionSigners = vi.fn().mockResolvedValue(new Map([["signer-1", 1n]]));

    await listActionSigners({
      sdk: { group: { actionSigners } } as never,
      contractId: "contract-1",
      actionId: "action-1",
      requiredPower: 2,
    });

    expect(actionSigners).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ACTIVE", actionId: "action-1" }),
    );
  });

  it("sums signer power and reports hasSigned correctly", async () => {
    const { listActionSigners } = await import("../src/dash/groupActions");
    const actionSigners = vi.fn().mockResolvedValue(
      new Map([
        ["panelist-a", 1n],
        ["panelist-b", 1n],
      ]),
    );

    const progress = await listActionSigners({
      sdk: { group: { actionSigners } } as never,
      contractId: "contract-1",
      actionId: "action-1",
      requiredPower: 2,
    });

    expect(progress.signedPower).toBe(2n);
    expect(progress.hasSigned("panelist-a")).toBe(true);
    expect(progress.hasSigned("panelist-c")).toBe(false);
  });
});
