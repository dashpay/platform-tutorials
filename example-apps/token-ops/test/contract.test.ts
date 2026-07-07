import { describe, expect, it, vi } from "vitest";

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

describe("TokenOps rule presets", () => {
  it("separates operator authority from admin authority", async () => {
    const { createRulePresets, TREASURY_GROUP_POSITION } = await import(
      "../src/dash/contract"
    );
    const presets = createRulePresets("owner-1") as unknown as {
      treasuryRules: {
        options: {
          authorizedToMakeChange: unknown;
          adminActionTakers: unknown;
          isChangingAuthorizedActionTakersToNoOneAllowed: boolean;
          isChangingAdminActionTakersToNoOneAllowed: boolean;
          isSelfChangingAdminActionTakersAllowed: boolean;
        };
      };
      lockedRules: {
        options: {
          authorizedToMakeChange: unknown;
          adminActionTakers: unknown;
        };
      };
    };

    expect(presets.treasuryRules.options.authorizedToMakeChange).toEqual({
      type: "Group",
      position: TREASURY_GROUP_POSITION,
    });
    expect(presets.treasuryRules.options.adminActionTakers).toEqual({
      type: "ContractOwner",
    });
    expect(
      presets.treasuryRules.options.isChangingAuthorizedActionTakersToNoOneAllowed,
    ).toBe(false);
    expect(
      presets.treasuryRules.options.isChangingAdminActionTakersToNoOneAllowed,
    ).toBe(false);
    expect(presets.treasuryRules.options.isSelfChangingAdminActionTakersAllowed).toBe(
      true,
    );
    expect(presets.lockedRules.options).toEqual({
      authorizedToMakeChange: { type: "NoOne" },
      adminActionTakers: { type: "NoOne" },
    });
  });
});

describe("TokenOps token configuration", () => {
  it("assigns lifecycle capabilities to the intended groups", async () => {
    const {
      ACCESS_GROUP_POSITION,
      EMERGENCY_GROUP_POSITION,
      TREASURY_GROUP_POSITION,
      createTokenOpsTokenConfiguration,
    } = await import("../src/dash/contract");
    const config = createTokenOpsTokenConfiguration("owner-1") as unknown as {
      options: Record<string, { options: Record<string, unknown> }>;
    };

    expect(
      config.options.manualMintingRules.options.authorizedToMakeChange,
    ).toEqual({ type: "Group", position: TREASURY_GROUP_POSITION });
    expect(
      config.options.manualBurningRules.options.authorizedToMakeChange,
    ).toEqual({ type: "Group", position: TREASURY_GROUP_POSITION });
    expect(config.options.freezeRules.options.authorizedToMakeChange).toEqual({
      type: "Group",
      position: ACCESS_GROUP_POSITION,
    });
    expect(config.options.unfreezeRules.options.authorizedToMakeChange).toEqual(
      { type: "Group", position: ACCESS_GROUP_POSITION },
    );
    expect(
      config.options.destroyFrozenFundsRules.options.authorizedToMakeChange,
    ).toEqual({ type: "Group", position: EMERGENCY_GROUP_POSITION });
    expect(
      config.options.emergencyActionRules.options.authorizedToMakeChange,
    ).toEqual({ type: "Group", position: EMERGENCY_GROUP_POSITION });
  });

  it("keeps all token histories enabled", async () => {
    const { createTokenOpsTokenConfiguration } = await import(
      "../src/dash/contract"
    );
    const config = createTokenOpsTokenConfiguration("owner-1") as unknown as {
      options: { keepsHistory: { options: Record<string, boolean> } };
    };

    expect(config.options.keepsHistory.options).toEqual({
      isKeepingBurningHistory: true,
      isKeepingDirectPricingHistory: true,
      isKeepingDirectPurchaseHistory: true,
      isKeepingFreezingHistory: true,
      isKeepingMintingHistory: true,
      isKeepingTransferHistory: true,
    });
  });
});

describe("TokenOps groups", () => {
  it("builds treasury, access, and emergency groups", async () => {
    const {
      ACCESS_GROUP_POSITION,
      EMERGENCY_GROUP_POSITION,
      TREASURY_GROUP_POSITION,
      createTokenOpsGroups,
    } = await import("../src/dash/contract");
    const groups = createTokenOpsGroups(["a", "b", "c"]);

    expect(groups[TREASURY_GROUP_POSITION].requiredPower).toBe(2);
    expect(groups[ACCESS_GROUP_POSITION].requiredPower).toBe(2);
    expect(groups[EMERGENCY_GROUP_POSITION].requiredPower).toBe(3);
  });
});
