import { describe, expect, it, vi } from "vitest";

// rotatePanelRoster imports createTriagePanelGroup from contract.ts, which
// statically imports the full SDK surface — mock everything contract.ts
// touches plus TokenConfigurationChangeItem (the piece under test here).
vi.mock("@dashevo/evo-sdk", () => ({
  DataContract: class DataContract {},
  Group: class Group {
    constructor(
      public members: Map<string, number>,
      public requiredPower: number,
    ) {}
  },
  AuthorizedActionTakers: {
    ContractOwner: () => ({ type: "ContractOwner" }),
    NoOne: () => ({ type: "NoOne" }),
    Group: (position: number) => ({ type: "Group", position }),
    MainGroup: () => ({ type: "MainGroup" }),
  },
  ChangeControlRules: class ChangeControlRules {
    constructor(public options: unknown) {}
  },
  TokenConfiguration: class TokenConfiguration {
    constructor(public options: unknown) {}
  },
  TokenConfigurationConvention: class TokenConfigurationConvention {},
  TokenConfigurationLocalization: class TokenConfigurationLocalization {},
  TokenDistributionRules: class TokenDistributionRules {},
  TokenKeepsHistoryRules: class TokenKeepsHistoryRules {},
  TokenMarketplaceRules: class TokenMarketplaceRules {},
  TokenTradeMode: { NotTradeable: () => ({ type: "NotTradeable" }) },
  TokenConfigurationChangeItem: {
    MainControlGroupItem: (position: number) => ({
      type: "MainControlGroupItem",
      position,
    }),
  },
}));

const identity = { id: { toString: () => "owner-1" } };
const identityKey = { id: "key-1" };
const signer = { id: "signer-1" };

function makeKeyManager() {
  return {
    async getAuth() {
      return { identity, identityKey, signer };
    },
  } as never;
}

function makeContract(groups: Record<number, unknown>, version = 1) {
  return { version, groups } as never;
}

const NEW_ROSTER = ["panelist-d", "panelist-e", "panelist-f"];

describe("rotatePanelRoster", () => {
  it("appends the replacement group at the next contiguous position and bumps the version", async () => {
    const { rotatePanelRoster } = await import("../src/dash/rotatePanelRoster");
    const foundingGroup = { members: new Map(), requiredPower: 2 };
    const contract = makeContract({ 0: foundingGroup }, 3);
    const update = vi.fn().mockResolvedValue(undefined);
    const configUpdate = vi.fn().mockResolvedValue({ document: {} });

    const newPosition = await rotatePanelRoster({
      sdk: {
        contracts: { fetch: vi.fn().mockResolvedValue(contract), update },
        tokens: { configUpdate },
      } as never,
      keyManager: makeKeyManager(),
      contractId: "contract-1",
      newPanelMemberIds: NEW_ROSTER,
    });

    expect(newPosition).toBe(1);
    const updated = update.mock.calls[0][0].dataContract as {
      version: number;
      groups: Record<
        number,
        { members: Map<string, number>; requiredPower: number }
      >;
    };
    expect(updated.version).toBe(4);
    // Existing group 0 is untouched — Platform rejects any change to it.
    expect(updated.groups[0]).toBe(foundingGroup);
    expect(updated.groups[1].requiredPower).toBe(2);
    expect([...updated.groups[1].members.keys()]).toEqual(NEW_ROSTER);
  });

  it("repoints the token's main control group at the appended position via configUpdate", async () => {
    const { rotatePanelRoster } = await import("../src/dash/rotatePanelRoster");
    const contract = makeContract({
      0: { members: new Map(), requiredPower: 2 },
      1: { members: new Map(), requiredPower: 2 },
    });
    const update = vi.fn().mockResolvedValue(undefined);
    const configUpdate = vi.fn().mockResolvedValue({ document: {} });

    const newPosition = await rotatePanelRoster({
      sdk: {
        contracts: { fetch: vi.fn().mockResolvedValue(contract), update },
        tokens: { configUpdate },
      } as never,
      keyManager: makeKeyManager(),
      contractId: "contract-1",
      newPanelMemberIds: NEW_ROSTER,
    });

    expect(newPosition).toBe(2);
    expect(configUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        dataContractId: "contract-1",
        tokenPosition: 0,
        identityId: "owner-1",
        configurationChangeItem: { type: "MainControlGroupItem", position: 2 },
      }),
    );
    // Order matters: the group must exist on-chain before the token config
    // can point at it.
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(
      configUpdate.mock.invocationCallOrder[0],
    );
  });

  it("rejects a replacement roster that isn't exactly 3 members, before any transition", async () => {
    const { rotatePanelRoster } = await import("../src/dash/rotatePanelRoster");
    const update = vi.fn();
    const configUpdate = vi.fn();

    await expect(
      rotatePanelRoster({
        sdk: {
          contracts: {
            fetch: vi
              .fn()
              .mockResolvedValue(
                makeContract({ 0: { members: new Map(), requiredPower: 2 } }),
              ),
            update,
          },
          tokens: { configUpdate },
        } as never,
        keyManager: makeKeyManager(),
        contractId: "contract-1",
        newPanelMemberIds: ["only-one", "only-two"],
      }),
    ).rejects.toThrow(/exactly 3/);

    expect(update).not.toHaveBeenCalled();
    expect(configUpdate).not.toHaveBeenCalled();
  });
});
