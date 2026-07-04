import { afterEach, describe, expect, it, vi } from "vitest";

const { mockDataContractCtor } = vi.hoisted(() => ({
  mockDataContractCtor: vi.fn(function MockDataContract(
    this: Record<string, unknown>,
    args: Record<string, unknown>,
  ) {
    Object.assign(this, args);
  }),
}));

vi.mock("@dashevo/evo-sdk", () => ({
  DataContract: mockDataContractCtor,
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
  },
  ChangeControlRules: class ChangeControlRules {
    constructor(public options: unknown) {}
  },
  TokenConfiguration: class TokenConfiguration {
    constructor(public options: unknown) {}
  },
  TokenConfigurationConvention: class TokenConfigurationConvention {
    constructor(
      public localizations: unknown,
      public decimals: number,
    ) {}
  },
  TokenConfigurationLocalization: class TokenConfigurationLocalization {
    constructor(
      public shouldCapitalize: boolean,
      public singularForm: string,
      public pluralForm: string,
    ) {}
  },
  TokenDistributionRules: class TokenDistributionRules {
    constructor(public options: unknown) {}
  },
  TokenKeepsHistoryRules: class TokenKeepsHistoryRules {
    constructor(public options: unknown) {}
  },
  TokenMarketplaceRules: class TokenMarketplaceRules {
    constructor(
      public tradeMode: unknown,
      public tradeModeChangeRules: unknown,
    ) {}
  },
  TokenTradeMode: {
    NotTradeable: () => ({ type: "NotTradeable" }),
  },
}));

describe("bounty contract schema", () => {
  it("charges 1 Researcher Credit per report, transferred to the contract owner", async () => {
    const { REPORT_SCHEMAS } = await import("../src/dash/contract");
    const { RESEARCHER_CREDIT_POSITION } =
      await import("../src/dash/researcherCredit");

    expect(REPORT_SCHEMAS.report.creationRestrictionMode).toBe(0);
    expect(REPORT_SCHEMAS.report.tokenCost.create).toEqual({
      tokenPosition: RESEARCHER_CREDIT_POSITION,
      amount: 1,
      effect: 0, // TransferTokenToContractOwner, NOT BurnToken — see contract.ts header
      gasFeesPaidBy: 0,
    });
  });

  it("never allows deleting a report, even post-slash", async () => {
    const { REPORT_SCHEMAS } = await import("../src/dash/contract");
    expect(REPORT_SCHEMAS.report.canBeDeleted).toBe(false);
  });

  it("keeps report edit history", async () => {
    const { REPORT_SCHEMAS } = await import("../src/dash/contract");
    expect(REPORT_SCHEMAS.report.documentsKeepHistory).toBe(true);
  });
});

describe("Researcher Credit token configuration", () => {
  it("gates freeze, unfreeze, and destroyFrozenFunds on the Triage Panel group", async () => {
    const { createResearcherCreditConfiguration, PANEL_GROUP_POSITION } =
      await import("../src/dash/contract");

    // The mocked TokenConfiguration constructor stores its whole options
    // object under `.options` rather than spreading it onto properties.
    const config = createResearcherCreditConfiguration(
      "owner-1",
    ) as unknown as {
      options: {
        freezeRules: { options: { authorizedToMakeChange: unknown } };
        unfreezeRules: { options: { authorizedToMakeChange: unknown } };
        destroyFrozenFundsRules: {
          options: { authorizedToMakeChange: unknown };
        };
        mainControlGroup: number;
      };
    };

    const groupSentinel = { type: "Group", position: PANEL_GROUP_POSITION };
    expect(config.options.freezeRules.options.authorizedToMakeChange).toEqual(
      groupSentinel,
    );
    expect(config.options.unfreezeRules.options.authorizedToMakeChange).toEqual(
      groupSentinel,
    );
    expect(
      config.options.destroyFrozenFundsRules.options.authorizedToMakeChange,
    ).toEqual(groupSentinel);
    expect(config.options.mainControlGroup).toBe(PANEL_GROUP_POSITION);
  });

  it("keeps admin control of freeze/unfreeze/destroy on the panel group too", async () => {
    const { createResearcherCreditConfiguration, PANEL_GROUP_POSITION } =
      await import("../src/dash/contract");
    const config = createResearcherCreditConfiguration(
      "owner-1",
    ) as unknown as {
      options: {
        freezeRules: { options: { adminActionTakers: unknown } };
        unfreezeRules: { options: { adminActionTakers: unknown } };
        destroyFrozenFundsRules: { options: { adminActionTakers: unknown } };
      };
    };

    const groupSentinel = { type: "Group", position: PANEL_GROUP_POSITION };
    expect(config.options.freezeRules.options.adminActionTakers).toEqual(
      groupSentinel,
    );
    expect(config.options.unfreezeRules.options.adminActionTakers).toEqual(
      groupSentinel,
    );
    expect(
      config.options.destroyFrozenFundsRules.options.adminActionTakers,
    ).toEqual(groupSentinel);
  });

  it("locks mainControlGroupCanBeModified to NoOne — the token can never be repointed at another group", async () => {
    const { createResearcherCreditConfiguration } =
      await import("../src/dash/contract");
    const config = createResearcherCreditConfiguration(
      "owner-1",
    ) as unknown as {
      options: { mainControlGroupCanBeModified: unknown };
    };
    // Combined with Platform's rule that existing groups can't be changed
    // in a contract update, this fixes the Triage Panel roster for the
    // contract's entire lifetime.
    expect(config.options.mainControlGroupCanBeModified).toEqual({
      type: "NoOne",
    });
  });

  it("locks manual burning to NoOne — the only way credits disappear is via destroyFrozen", async () => {
    const { createResearcherCreditConfiguration } =
      await import("../src/dash/contract");
    const config = createResearcherCreditConfiguration(
      "owner-1",
    ) as unknown as {
      options: {
        manualBurningRules: { options: { authorizedToMakeChange: unknown } };
      };
    };
    expect(
      config.options.manualBurningRules.options.authorizedToMakeChange,
    ).toEqual({ type: "NoOne" });
  });

  it("seeds a nonzero base supply so the owner has a working pool at genesis", async () => {
    const { createResearcherCreditConfiguration } =
      await import("../src/dash/contract");
    const config = createResearcherCreditConfiguration(
      "owner-1",
    ) as unknown as { options: { baseSupply: bigint } };
    expect(config.options.baseSupply).toBeGreaterThan(0n);
  });
});

describe("Triage Panel group", () => {
  it("builds a genuine 2-of-3 group: 3 members at equal power, requiredPower 2", async () => {
    const { createTriagePanelGroup, PANEL_REQUIRED_POWER } =
      await import("../src/dash/contract");
    const group = createTriagePanelGroup([
      "panelist-a",
      "panelist-b",
      "panelist-c",
    ]);

    expect(PANEL_REQUIRED_POWER).toBe(2);
    expect(group.requiredPower).toBe(2);
    expect(group.members.size).toBe(3);
    expect([...group.members.values()]).toEqual([1, 1, 1]);
  });

  it("rejects a panel that isn't exactly 3 members", async () => {
    const { createTriagePanelGroup } = await import("../src/dash/contract");
    expect(() => createTriagePanelGroup(["a", "b"])).toThrow(/exactly 3/);
    expect(() => createTriagePanelGroup(["a", "b", "c", "d"])).toThrow(
      /exactly 3/,
    );
  });
});

describe("registerContract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("assigns the Triage Panel group to dataContract.groups, not the constructor", async () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    } as unknown as Storage);

    const { registerContract, PANEL_GROUP_POSITION } =
      await import("../src/dash/contract");

    const identity = { id: { toString: () => "owner-1" } };
    const identityKey = { id: "key-1" };
    const signer = { id: "signer-1" };
    const publish = vi.fn().mockResolvedValue({ id: "contract-1" });

    await registerContract({
      sdk: {
        identities: { nonce: vi.fn().mockResolvedValue(0n) },
        contracts: { publish },
      } as never,
      keyManager: {
        async getAuth() {
          return { identity, identityKey, signer };
        },
      } as never,
      panelMemberIds: ["panelist-a", "panelist-b", "panelist-c"],
    });

    const publishedArgs = publish.mock.calls[0][0];
    const dataContract = publishedArgs.dataContract as {
      groups: Record<
        number,
        { members: Map<string, number>; requiredPower: number }
      >;
    };
    expect(dataContract.groups[PANEL_GROUP_POSITION].requiredPower).toBe(2);
    expect(dataContract.groups[PANEL_GROUP_POSITION].members.size).toBe(3);
  });
});
