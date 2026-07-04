import { describe, expect, it, vi } from "vitest";

// panel.ts pulls constants from contract.ts, which statically imports the
// SDK — mock the whole module surface contract.ts touches.
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

function makeSdk({
  mainControlGroup,
  groupInfo,
}: {
  mainControlGroup?: number;
  groupInfo?: Record<
    number,
    { members: Map<string, number>; requiredPower: number }
  >;
}) {
  return {
    contracts: {
      fetch: vi.fn().mockResolvedValue({
        version: 1,
        tokens: { 0: { mainControlGroup } },
      }),
    },
    group: {
      info: vi.fn(
        async (_contractId: string, position: number) => groupInfo?.[position],
      ),
      members: vi.fn(async ({ groupContractPosition }) => {
        const info = groupInfo?.[groupContractPosition as number];
        return info ? new Map(info.members) : new Map();
      }),
    },
  } as never;
}

describe("fetchActivePanelPosition", () => {
  it("resolves the token's current mainControlGroup from the contract", async () => {
    const { fetchActivePanelPosition } = await import("../src/dash/panel");
    const position = await fetchActivePanelPosition({
      sdk: makeSdk({ mainControlGroup: 2 }),
      contractId: "contract-1",
    });
    expect(position).toBe(2);
  });

  it("falls back to the founding group 0 when the config exposes none", async () => {
    const { fetchActivePanelPosition } = await import("../src/dash/panel");
    const position = await fetchActivePanelPosition({
      sdk: makeSdk({}),
      contractId: "contract-1",
    });
    expect(position).toBe(0);
  });
});

describe("fetchPanelInfo", () => {
  it("reads the group at the ACTIVE position, not the founding group 0", async () => {
    const { fetchPanelInfo } = await import("../src/dash/panel");
    const info = await fetchPanelInfo({
      sdk: makeSdk({
        mainControlGroup: 1,
        groupInfo: {
          0: { members: new Map([["old-panelist", 1]]), requiredPower: 2 },
          1: { members: new Map([["new-panelist", 1]]), requiredPower: 2 },
        },
      }),
      contractId: "contract-1",
    });

    expect(info.groupPosition).toBe(1);
    expect([...info.members.keys()]).toEqual(["new-panelist"]);
  });
});

describe("fetchPanelMembers", () => {
  it("resolves the active position itself when none is supplied", async () => {
    const { fetchPanelMembers } = await import("../src/dash/panel");
    const members = await fetchPanelMembers({
      sdk: makeSdk({
        mainControlGroup: 1,
        groupInfo: {
          0: { members: new Map([["old-panelist", 1]]), requiredPower: 2 },
          1: { members: new Map([["new-panelist", 1]]), requiredPower: 2 },
        },
      }),
      contractId: "contract-1",
    });
    expect(members).toEqual(["new-panelist"]);
  });
});
