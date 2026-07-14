// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    constructor(public options: Record<string, unknown>) {
      // Model the real constructor's expected shape: reject any argument whose
      // keys don't match the six history flags. A mis-wired or misspelled flag
      // in the source then throws here instead of silently round-tripping.
      const expected = [
        "isKeepingBurningHistory",
        "isKeepingDirectPricingHistory",
        "isKeepingDirectPurchaseHistory",
        "isKeepingFreezingHistory",
        "isKeepingMintingHistory",
        "isKeepingTransferHistory",
      ].sort();
      const received = Object.keys(options).sort();
      if (JSON.stringify(received) !== JSON.stringify(expected)) {
        throw new Error(
          `TokenKeepsHistoryRules received unexpected keys: ${received.join(", ")}`,
        );
      }
    }
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

interface PresetOptions {
  authorizedToMakeChange: unknown;
  adminActionTakers: unknown;
  isChangingAuthorizedActionTakersToNoOneAllowed?: boolean;
  isChangingAdminActionTakersToNoOneAllowed?: boolean;
  isSelfChangingAdminActionTakersAllowed?: boolean;
}

describe("TokenOps rule presets", () => {
  it("separates operator authority from admin authority", async () => {
    const { createRulePresets, TREASURY_GROUP_POSITION } =
      await import("../src/dash/contract");
    const presets = (await createRulePresets("owner-1")) as unknown as {
      treasuryRules: { options: PresetOptions };
    };

    expect(presets.treasuryRules.options.authorizedToMakeChange).toEqual({
      type: "Group",
      position: TREASURY_GROUP_POSITION,
    });
    expect(presets.treasuryRules.options.adminActionTakers).toEqual({
      type: "ContractOwner",
    });
    expect(
      presets.treasuryRules.options
        .isChangingAuthorizedActionTakersToNoOneAllowed,
    ).toBe(false);
    expect(
      presets.treasuryRules.options.isChangingAdminActionTakersToNoOneAllowed,
    ).toBe(false);
    expect(
      presets.treasuryRules.options.isSelfChangingAdminActionTakersAllowed,
    ).toBe(true);
  });

  it("assigns each group preset its own operator group with owner admin", async () => {
    const {
      createRulePresets,
      ACCESS_GROUP_POSITION,
      EMERGENCY_GROUP_POSITION,
    } = await import("../src/dash/contract");
    const presets = (await createRulePresets("owner-1")) as unknown as {
      accessRules: { options: PresetOptions };
      emergencyRules: { options: PresetOptions };
      ownerRules: { options: PresetOptions };
    };

    expect(presets.accessRules.options.authorizedToMakeChange).toEqual({
      type: "Group",
      position: ACCESS_GROUP_POSITION,
    });
    expect(presets.accessRules.options.adminActionTakers).toEqual({
      type: "ContractOwner",
    });
    expect(presets.emergencyRules.options.authorizedToMakeChange).toEqual({
      type: "Group",
      position: EMERGENCY_GROUP_POSITION,
    });
    expect(presets.emergencyRules.options.adminActionTakers).toEqual({
      type: "ContractOwner",
    });
    expect(presets.ownerRules.options.authorizedToMakeChange).toEqual({
      type: "ContractOwner",
    });
    expect(presets.ownerRules.options.adminActionTakers).toEqual({
      type: "ContractOwner",
    });
  });

  it("locks the locked preset to NoOne on both authorities", async () => {
    const { createRulePresets } = await import("../src/dash/contract");
    const presets = (await createRulePresets("owner-1")) as unknown as {
      lockedRules: { options: PresetOptions };
    };
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
    const config = (await createTokenOpsTokenConfiguration(
      "owner-1",
    )) as unknown as {
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
    const { createTokenOpsTokenConfiguration } =
      await import("../src/dash/contract");
    // The mock TokenKeepsHistoryRules constructor throws if the source passes
    // any key other than the six history flags, so a mis-wired flag name fails
    // at construction here. This value assertion then confirms each flag is on.
    const config = (await createTokenOpsTokenConfiguration(
      "owner-1",
    )) as unknown as {
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
  it("builds each group with the defined threshold and all three members", async () => {
    const {
      ACCESS_GROUP_POSITION,
      EMERGENCY_GROUP_POSITION,
      TREASURY_GROUP_POSITION,
      createTokenOpsGroups,
    } = await import("../src/dash/contract");
    const groups = (await createTokenOpsGroups([
      "a",
      "b",
      "c",
    ])) as unknown as Record<
      number,
      { members: Map<string, number>; requiredPower: number }
    >;

    // Product contract is 2-of-3 / 2-of-3 / 3-of-3 (see CLAUDE.md). Assert the
    // literals so an accidental change to the wiring is caught even if it
    // still tracks GROUP_DEFINITIONS.
    expect(groups[TREASURY_GROUP_POSITION].requiredPower).toBe(2);
    expect(groups[ACCESS_GROUP_POSITION].requiredPower).toBe(2);
    expect(groups[EMERGENCY_GROUP_POSITION].requiredPower).toBe(3);

    // Every group carries all three members, each with power 1.
    for (const position of [
      TREASURY_GROUP_POSITION,
      ACCESS_GROUP_POSITION,
      EMERGENCY_GROUP_POSITION,
    ]) {
      const members = groups[position].members;
      expect([...members.entries()]).toEqual([
        ["a", 1],
        ["b", 1],
        ["c", 1],
      ]);
    }
  });

  it("defines the product 2/2/3 group thresholds", async () => {
    const { GROUP_DEFINITIONS } = await import("../src/dash/contract");
    // Separate from the wiring test: catches a change to the spec constants
    // themselves. Both must change for a threshold shift to slip through.
    expect(GROUP_DEFINITIONS.treasury.requiredPower).toBe(2);
    expect(GROUP_DEFINITIONS.access.requiredPower).toBe(2);
    expect(GROUP_DEFINITIONS.emergency.requiredPower).toBe(3);
  });
});

describe("createTokenOpsGroup validation", () => {
  it("requires exactly three members", async () => {
    const { createTokenOpsGroup } = await import("../src/dash/contract");
    await expect(createTokenOpsGroup(["a", "b"], 2)).rejects.toThrow(
      /exactly 3 members/,
    );
    await expect(createTokenOpsGroup(["a", "b", "c", "d"], 2)).rejects.toThrow(
      /exactly 3 members/,
    );
  });

  it("rejects duplicate member identities", async () => {
    const { createTokenOpsGroup } = await import("../src/dash/contract");
    await expect(createTokenOpsGroup(["a", "a", "b"], 2)).rejects.toThrow(
      /distinct/,
    );
  });

  it("rejects a required power outside 1..3", async () => {
    const { createTokenOpsGroup } = await import("../src/dash/contract");
    await expect(createTokenOpsGroup(["a", "b", "c"], 0)).rejects.toThrow(
      /required power/,
    );
    await expect(createTokenOpsGroup(["a", "b", "c"], 4)).rejects.toThrow(
      /required power/,
    );
  });
});

describe("buildTokenOpsGroup validation", () => {
  it("accepts any member count within Platform bounds", async () => {
    const { buildTokenOpsGroup, MIN_GROUP_MEMBERS, MAX_GROUP_MEMBERS } =
      await import("../src/dash/contract");
    const two = (await buildTokenOpsGroup(["a", "b"], 2)) as unknown as {
      members: Map<string, number>;
      requiredPower: number;
    };
    expect(two.members.size).toBe(MIN_GROUP_MEMBERS);
    expect(two.requiredPower).toBe(2);

    const ids = Array.from({ length: 5 }, (_, i) => `id-${i}`);
    const five = (await buildTokenOpsGroup(ids, 3)) as unknown as {
      members: Map<string, number>;
    };
    expect(five.members.size).toBe(5);
    // Every member carries power 1, so requiredPower is a signature threshold.
    expect([...five.members.values()].every((p) => p === 1)).toBe(true);
    expect(MAX_GROUP_MEMBERS).toBe(256);
  });

  it("rejects fewer than the minimum members", async () => {
    const { buildTokenOpsGroup } = await import("../src/dash/contract");
    await expect(buildTokenOpsGroup(["a"], 1)).rejects.toThrow(/2-256 members/);
    await expect(buildTokenOpsGroup([], 1)).rejects.toThrow(/2-256 members/);
  });

  it("rejects more than the maximum members", async () => {
    const { buildTokenOpsGroup, MAX_GROUP_MEMBERS } =
      await import("../src/dash/contract");
    const tooMany = Array.from(
      { length: MAX_GROUP_MEMBERS + 1 },
      (_, i) => `id-${i}`,
    );
    await expect(buildTokenOpsGroup(tooMany, 1)).rejects.toThrow(
      /2-256 members/,
    );
  });

  it("rejects duplicate member identities", async () => {
    const { buildTokenOpsGroup } = await import("../src/dash/contract");
    await expect(buildTokenOpsGroup(["a", "a", "b"], 2)).rejects.toThrow(
      /distinct/,
    );
  });

  it("rejects a required power above the member count", async () => {
    const { buildTokenOpsGroup } = await import("../src/dash/contract");
    await expect(buildTokenOpsGroup(["a", "b"], 0)).rejects.toThrow(
      /required power/,
    );
    await expect(buildTokenOpsGroup(["a", "b"], 3)).rejects.toThrow(
      /required power/,
    );
    // Scales with the member count: 4-of-5 is fine.
    await expect(
      buildTokenOpsGroup(["a", "b", "c", "d", "e"], 4),
    ).resolves.toBeDefined();
  });
});

const STORAGE_KEY = "token-ops.contractId";

function makeKeyManager(ownerId = "owner-1") {
  return {
    identityId: ownerId,
    async getAuth() {
      return {
        identity: { id: { toString: () => ownerId } },
        identityKey: "identity-key",
        signer: "signer",
      };
    },
  } as never;
}

describe("registerContract", () => {
  beforeEach(() => {
    localStorage.clear();
    // Constructor mock accumulates calls across tests; clear it so
    // toHaveBeenCalledWith reflects only the current test's construction.
    mockDataContractCtor.mockClear();
  });
  afterEach(() => localStorage.clear());

  function makeSdk(publishResult: unknown, nonce: bigint | null = 4n) {
    const publish = vi.fn().mockResolvedValue(publishResult);
    return {
      sdk: {
        identities: { nonce: vi.fn().mockResolvedValue(nonce) },
        contracts: { publish },
      } as never,
      publish,
    };
  }

  it("bumps the nonce, assigns all three groups, and persists the id", async () => {
    const {
      registerContract,
      ACCESS_GROUP_POSITION,
      EMERGENCY_GROUP_POSITION,
      TREASURY_GROUP_POSITION,
      GROUP_DEFINITIONS,
    } = await import("../src/dash/contract");
    const { sdk, publish } = makeSdk({ id: { toString: () => "contract-1" } });

    const id = await registerContract({
      sdk,
      keyManager: makeKeyManager("owner-1"),
      groupMemberIds: ["a", "b", "c"],
    });

    expect(id).toBe("contract-1");
    // Nonce is bumped by 1 from the fetched value.
    expect(mockDataContractCtor).toHaveBeenCalledWith(
      expect.objectContaining({ identityNonce: 5n, fullValidation: true }),
    );
    // All three governance groups are attached before publish.
    const published = publish.mock.calls[0][0].dataContract as {
      groups: Record<number, { requiredPower: number }>;
    };
    expect(published.groups[TREASURY_GROUP_POSITION].requiredPower).toBe(
      GROUP_DEFINITIONS.treasury.requiredPower,
    );
    expect(published.groups[ACCESS_GROUP_POSITION].requiredPower).toBe(
      GROUP_DEFINITIONS.access.requiredPower,
    );
    expect(published.groups[EMERGENCY_GROUP_POSITION].requiredPower).toBe(
      GROUP_DEFINITIONS.emergency.requiredPower,
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe("contract-1");
  });

  it("treats a null nonce as 0 before bumping", async () => {
    const { registerContract } = await import("../src/dash/contract");
    const { sdk } = makeSdk({ id: { toString: () => "c" } }, null);

    await registerContract({
      sdk,
      keyManager: makeKeyManager(),
      groupMemberIds: ["a", "b", "c"],
    });

    expect(mockDataContractCtor).toHaveBeenCalledWith(
      expect.objectContaining({ identityNonce: 1n }),
    );
  });

  it("falls back to toJSON().id when published.id is absent", async () => {
    const { registerContract } = await import("../src/dash/contract");
    const { sdk } = makeSdk({
      id: undefined,
      toJSON: () => ({ id: "json-id" }),
    });

    const id = await registerContract({
      sdk,
      keyManager: makeKeyManager(),
      groupMemberIds: ["a", "b", "c"],
    });

    expect(id).toBe("json-id");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("json-id");
  });

  it("throws and persists nothing when publish returns no id", async () => {
    const { registerContract } = await import("../src/dash/contract");
    const { sdk } = makeSdk({ toJSON: () => ({}) });

    await expect(
      registerContract({
        sdk,
        keyManager: makeKeyManager(),
        groupMemberIds: ["a", "b", "c"],
      }),
    ).rejects.toThrow(/no id/i);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("ensureContract", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  function idleSdk() {
    return {
      identities: { nonce: vi.fn() },
      contracts: { publish: vi.fn() },
    } as never;
  }

  it("short-circuits on an explicit existingId without publishing", async () => {
    const { ensureContract } = await import("../src/dash/contract");
    const sdk = idleSdk();

    const id = await ensureContract({
      sdk,
      keyManager: makeKeyManager(),
      existingId: "supplied",
      groupMemberIds: ["a", "b", "c"],
    });

    expect(id).toBe("supplied");
    expect(
      (sdk as { contracts: { publish: ReturnType<typeof vi.fn> } }).contracts
        .publish,
    ).not.toHaveBeenCalled();
  });

  it("uses the bundled default contract id when storage is empty", async () => {
    const { ensureContract, DEFAULT_CONTRACT_ID } =
      await import("../src/dash/contract");
    const sdk = idleSdk();

    const id = await ensureContract({
      sdk,
      keyManager: makeKeyManager(),
      groupMemberIds: ["a", "b", "c"],
    });

    expect(id).toBe(DEFAULT_CONTRACT_ID);
    expect(
      (sdk as { contracts: { publish: ReturnType<typeof vi.fn> } }).contracts
        .publish,
    ).not.toHaveBeenCalled();
  });

  it("registers a fresh contract only when no stored id is reusable", async () => {
    const { ensureContract } = await import("../src/dash/contract");
    // Only an explicit empty string defeats the DEFAULT_CONTRACT_ID fallback.
    localStorage.setItem(STORAGE_KEY, "");
    const publish = vi
      .fn()
      .mockResolvedValue({ id: { toString: () => "fresh-id" } });
    const sdk = {
      identities: { nonce: vi.fn().mockResolvedValue(0n) },
      contracts: { publish },
    } as never;

    const id = await ensureContract({
      sdk,
      keyManager: makeKeyManager(),
      groupMemberIds: ["a", "b", "c"],
    });

    expect(id).toBe("fresh-id");
    expect(publish).toHaveBeenCalled();
  });
});
