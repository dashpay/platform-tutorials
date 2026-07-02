import { describe, expect, it, vi } from "vitest";

vi.mock("@dashevo/evo-sdk", () => ({
  Group: class Group {
    constructor(
      public members: Map<string, number>,
      public requiredPower: number,
    ) {}
  },
}));

function makeExistingContract(memberIds: string[]) {
  return {
    version: 1,
    groups: {
      0: {
        members: new Map(memberIds.map((id) => [id, 1])),
        requiredPower: 2,
      },
    },
  };
}

describe("updatePanelRoster", () => {
  it("swaps a member out and bumps the contract version", async () => {
    const { updatePanelRoster } = await import("../src/dash/updatePanelRoster");
    const existing = makeExistingContract(["a", "b", "c"]);
    const fetch = vi.fn().mockResolvedValue(existing);
    const update = vi.fn().mockResolvedValue(undefined);

    await updatePanelRoster({
      sdk: { contracts: { fetch, update } } as never,
      keyManager: {
        async getAuth() {
          return { identityKey: { id: "key-1" }, signer: { id: "signer-1" } };
        },
      } as never,
      contractId: "contract-1",
      addMemberId: "d",
      removeMemberId: "a",
    });

    const updatedArgs = update.mock.calls[0][0];
    const updatedContract = updatedArgs.dataContract as {
      version: number;
      groups: Record<number, { members: Map<string, number> }>;
    };
    expect(updatedContract.version).toBe(2);
    const members = [...updatedContract.groups[0].members.keys()];
    expect(members).toContain("d");
    expect(members).not.toContain("a");
    expect(members).toHaveLength(3);
  });

  it("rejects a roster that wouldn't have exactly 3 members", async () => {
    const { updatePanelRoster } = await import("../src/dash/updatePanelRoster");
    const existing = makeExistingContract(["a", "b", "c"]);
    const fetch = vi.fn().mockResolvedValue(existing);
    const update = vi.fn();

    await expect(
      updatePanelRoster({
        sdk: { contracts: { fetch, update } } as never,
        keyManager: {
          async getAuth() {
            return { identityKey: { id: "key-1" }, signer: { id: "signer-1" } };
          },
        } as never,
        contractId: "contract-1",
        addMemberId: "d",
        // no removeMemberId — would grow the panel to 4 members
      }),
    ).rejects.toThrow(/exactly 3/);
    expect(update).not.toHaveBeenCalled();
  });

  it("requires at least one of addMemberId or removeMemberId", async () => {
    const { updatePanelRoster } = await import("../src/dash/updatePanelRoster");
    await expect(
      updatePanelRoster({
        sdk: {} as never,
        keyManager: {} as never,
        contractId: "contract-1",
      }),
    ).rejects.toThrow();
  });
});
