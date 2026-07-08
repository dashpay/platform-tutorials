import { describe, expect, it, vi } from "vitest";

// governance.ts imports createTokenOpsGroup from contract.ts, which imports
// several @dashevo/evo-sdk value symbols at module load. Mock them so the
// suite never pulls in the real WASM bundle. Group is the only one whose shape
// the appendTokenOpsGroup tests inspect.
vi.mock("@dashevo/evo-sdk", () => ({
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
  DataContract: class DataContract {},
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
}));

import {
  appendTokenOpsGroup,
  deriveRules,
  fetchTokenOpsGovernance,
} from "../src/dash/governance";
import {
  deriveGroupDomains,
  formatGroupIdentity,
  groupCapabilities,
  groupDisplay,
} from "../src/dash/groupDisplay";
import type { RuleInfo } from "../src/dash/governance";

function groupDisplayRule(key: string, groupPosition: number): RuleInfo {
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

describe("group display helpers", () => {
  it("derives group identity from live operator rules", () => {
    const rules = [
      groupDisplayRule("manualMinting", 1),
      groupDisplayRule("manualBurning", 1),
    ];

    expect(deriveGroupDomains(1, rules).map((domain) => domain.label)).toEqual([
      "Treasury",
    ]);
    expect(groupCapabilities(1, rules).map((rule) => rule.key)).toEqual([
      "manualMinting",
      "manualBurning",
    ]);
    expect(formatGroupIdentity(1, rules)).toBe("Group 1 · Treasury");
  });

  it("derives every domain when a group controls multiple domains", () => {
    const rules = [
      groupDisplayRule("destroyFrozenFunds", 2),
      groupDisplayRule("emergencyAction", 2),
    ];

    expect(deriveGroupDomains(2, rules).map((domain) => domain.label)).toEqual([
      "Access",
      "Emergency",
    ]);
    expect(formatGroupIdentity(2, rules)).toBe("Group 2 · Access + Emergency");
  });

  it("formats groups with no live operator capabilities", () => {
    expect(formatGroupIdentity(3, [groupDisplayRule("manualMinting", 0)])).toBe(
      "Group 3 · no capabilities",
    );
  });

  it("derives config display for config-only group authority", () => {
    const display = groupDisplay(4, [groupDisplayRule("maxSupply", 4)]);

    expect(display).toEqual({
      position: 4,
      domains: [{ label: "Config", accent: "blue" }],
      capabilities: [groupDisplayRule("maxSupply", 4)],
      accent: "teal",
    });
  });

  it("keeps accents distinct when groups share a derived domain", () => {
    const rules = [
      groupDisplayRule("freeze", 1),
      groupDisplayRule("unfreeze", 2),
    ];

    expect(deriveGroupDomains(1, rules)[0]?.label).toBe("Access");
    expect(deriveGroupDomains(2, rules)[0]?.label).toBe("Access");
    expect(groupDisplay(1, rules).accent).not.toBe(groupDisplay(2, rules).accent);
  });

  it("uses position accent for empty groups", () => {
    const display = groupDisplay(5, [groupDisplayRule("manualMinting", 0)]);

    expect(display.domains).toEqual([]);
    expect(display.capabilities).toEqual([]);
    expect(display.accent).toBe("red");
  });
});

describe("deriveRules", () => {
  it("reads operator and admin authorities separately", async () => {
    const rules = deriveRules({
      manualMintingRules: {
        authorizedToMakeChange: { type: "Group", position: 0 },
        adminActionTakers: { type: "ContractOwner" },
        isChangingAuthorizedActionTakersToNoOneAllowed: false,
        isChangingAdminActionTakersToNoOneAllowed: false,
      },
    });

    const minting = rules.find((rule) => rule.key === "manualMinting");
    expect(minting?.operator).toEqual({
      type: "Group",
      groupPosition: 0,
      raw: { type: "Group", position: 0 },
    });
    expect(minting?.admin.type).toBe("ContractOwner");
    expect(minting?.canSetOperatorToNoOne).toBe(false);
    expect(minting?.canSetAdminToNoOne).toBe(false);
  });

  it("keeps operator and admin authorities uncrossed when both are groups", () => {
    // The app's whole premise: operator and admin must not be swapped. Use
    // deliberately swappable values (both groups, different positions) so a
    // crossed read would produce a visibly wrong result.
    const rules = deriveRules({
      manualMintingRules: {
        authorizedToMakeChange: { type: "Group", position: 1 },
        adminActionTakers: { type: "Group", position: 0 },
      },
    });

    const minting = rules.find((rule) => rule.key === "manualMinting");
    expect(minting?.operator.type).toBe("Group");
    expect(minting?.operator.groupPosition).toBe(1);
    expect(minting?.admin.type).toBe("Group");
    expect(minting?.admin.groupPosition).toBe(0);
  });

  it("reads snake_case authority and no-one-allowed fields", () => {
    const rules = deriveRules({
      manualMintingRules: {
        authorized_to_make_change: { type: "Group", position: 2 },
        admin_action_takers: { type: "ContractOwner" },
        is_changing_authorized_action_takers_to_no_one_allowed: true,
        is_changing_admin_action_takers_to_no_one_allowed: true,
      },
    });

    const minting = rules.find((rule) => rule.key === "manualMinting");
    expect(minting?.operator.groupPosition).toBe(2);
    expect(minting?.admin.type).toBe("ContractOwner");
    expect(minting?.canSetOperatorToNoOne).toBe(true);
    expect(minting?.canSetAdminToNoOne).toBe(true);
  });

  it("reads rules nested under distributionRules and marketplaceRules", () => {
    const rules = deriveRules({
      distributionRules: {
        perpetualDistributionRules: {
          authorizedToMakeChange: { type: "Group", position: 3 },
        },
      },
      marketplaceRules: {
        tradeModeChangeRules: {
          authorizedToMakeChange: { type: "Group", position: 4 },
        },
      },
    });

    expect(
      rules.find((rule) => rule.key === "perpetualDistribution")?.operator
        .groupPosition,
    ).toBe(3);
    expect(
      rules.find((rule) => rule.key === "marketplaceTradeMode")?.operator
        .groupPosition,
    ).toBe(4);
  });

  it("classifies each authority type", () => {
    const authorityFor = (raw: unknown) =>
      deriveRules({ manualMintingRules: { authorizedToMakeChange: raw } }).find(
        (rule) => rule.key === "manualMinting",
      )?.operator;

    expect(authorityFor({ type: "ContractOwner" })?.type).toBe("ContractOwner");
    expect(authorityFor({ type: "NoOne" })?.type).toBe("NoOne");
    expect(authorityFor({ type: "MainGroup" })?.type).toBe("MainGroup");

    const identity = authorityFor({ type: "Identity", value: "id-1" });
    expect(identity?.type).toBe("Identity");
    expect(identity?.identityId).toBe("id-1");

    // Group position from an explicit type, a string position, and the
    // bare-number shorthand all resolve to a numeric groupPosition.
    expect(authorityFor({ type: "Group", position: 2 })?.groupPosition).toBe(2);
    expect(authorityFor({ type: "Group", position: "5" })?.groupPosition).toBe(5);
    expect(authorityFor(7)?.type).toBe("Group");
    expect(authorityFor(7)?.groupPosition).toBe(7);

    expect(authorityFor({ type: "Whatever" })?.type).toBe("Unknown");
  });

  it("includes deferred config rows in the matrix", () => {
    const keys = deriveRules({}).map((rule) => rule.key);
    expect(keys).toContain("directPurchasePricing");
    expect(keys).toContain("perpetualDistribution");
    expect(keys).toContain("marketplaceTradeMode");
  });
});

describe("fetchTokenOpsGovernance", () => {
  it("normalizes fetched groups (sorted, members + threshold) from the contract", async () => {
    // Group normalization is exercised through the public read path rather
    // than the private helper. Shapes here match what a fetched contract
    // exposes: a positions object whose group members are a Map and whose
    // threshold may arrive snake_case.
    const contracts = {
      fetch: vi.fn().mockResolvedValue({
        groups: {
          "1": {
            members: new Map([["access-a", 1]]),
            requiredPower: 2,
          },
          "0": {
            members: new Map([["treasury-a", 1]]),
            required_power: 2,
          },
          "2": {
            members: new Map([["emergency-a", 1]]),
            requiredPower: 3,
          },
        },
        tokens: {},
      }),
    };

    const governance = await fetchTokenOpsGovernance({
      sdk: { contracts } as never,
      contractId: "contract-1",
    });

    // Sorted by position, threshold read (incl. snake_case fallback), members
    // carried through.
    expect(governance.groups.map((group) => group.groupPosition)).toEqual([
      0, 1, 2,
    ]);
    expect(governance.groups[0].requiredPower).toBe(2);
    expect(governance.groups[2].requiredPower).toBe(3);
    expect(governance.groups[0].members.get("treasury-a")).toBe(1);
  });

  it("throws when the contract is not found", async () => {
    const contracts = { fetch: vi.fn().mockResolvedValue(null) };
    await expect(
      fetchTokenOpsGovernance({
        sdk: { contracts } as never,
        contractId: "missing",
      }),
    ).rejects.toThrow(/not found/);
  });
});

describe("appendTokenOpsGroup", () => {
  const members = ["m-a", "m-b", "m-c"];
  const signer = { id: "signer" } as never;
  const identityKey = { id: "key" } as never;

  function makeSdk(contract: unknown) {
    const update = vi.fn().mockResolvedValue({});
    const fetch = vi.fn().mockResolvedValue(contract);
    return {
      sdk: { contracts: { fetch, update } } as never,
      update,
      fetch,
    };
  }

  it("appends at max(existing)+1 without overwriting a Map of groups", async () => {
    // Existing positions 0 and 1 -> new group must land at 2. Overwriting an
    // existing position would violate Platform's immutable-group rule.
    const groups = new Map<number, unknown>([
      [0, { members: { a: 1 }, requiredPower: 2 }],
      [1, { members: { b: 1 }, requiredPower: 2 }],
    ]);
    const contract: Record<string, unknown> = { groups, version: 3 };
    const { sdk, update } = makeSdk(contract);

    const position = await appendTokenOpsGroup({
      sdk,
      contractId: "contract-1",
      memberIds: members,
      requiredPower: 3,
      identityKey,
      signer,
    });

    expect(position).toBe(2);
    // Original groups untouched; new group added at 2 with requiredPower 3.
    expect(groups.has(0)).toBe(true);
    expect(groups.has(1)).toBe(true);
    const appended = groups.get(2) as { requiredPower: number };
    expect(appended.requiredPower).toBe(3);
    // The mutated contract is the object handed to update().
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ dataContract: contract, identityKey, signer }),
    );
  });

  it("appends via object spread when groups is a plain object", async () => {
    const contract: Record<string, unknown> = {
      groups: { "0": { members: { a: 1 }, requiredPower: 2 } },
      version: 1,
    };
    const { sdk } = makeSdk(contract);

    const position = await appendTokenOpsGroup({
      sdk,
      contractId: "contract-1",
      memberIds: members,
      requiredPower: 2,
      identityKey,
      signer,
    });

    expect(position).toBe(1);
    const groups = contract.groups as Record<string, unknown>;
    // Existing entry preserved, new entry added.
    expect(groups["0"]).toBeDefined();
    expect(groups["1"]).toBeDefined();
  });

  it("starts at position 0 for a contract with no groups", async () => {
    const contract: Record<string, unknown> = { version: 1 };
    const { sdk } = makeSdk(contract);

    const position = await appendTokenOpsGroup({
      sdk,
      contractId: "contract-1",
      memberIds: members,
      requiredPower: 2,
      identityKey,
      signer,
    });

    expect(position).toBe(0);
  });

  it("bumps the contract version before updating", async () => {
    const contract: Record<string, unknown> = { groups: {}, version: 7 };
    const { sdk } = makeSdk(contract);

    await appendTokenOpsGroup({
      sdk,
      contractId: "contract-1",
      memberIds: members,
      requiredPower: 2,
      identityKey,
      signer,
    });

    expect(contract.version).toBe(8);
  });

  it("throws when the contract cannot be fetched", async () => {
    const { sdk, update } = makeSdk(null);

    await expect(
      appendTokenOpsGroup({
        sdk,
        contractId: "missing",
        memberIds: members,
        requiredPower: 2,
        identityKey,
        signer,
      }),
    ).rejects.toThrow(/not found/);
    expect(update).not.toHaveBeenCalled();
  });

  it("validates member input before fetching or updating the contract", async () => {
    const { sdk, fetch, update } = makeSdk({ groups: {}, version: 1 });

    await expect(
      appendTokenOpsGroup({
        sdk,
        contractId: "contract-1",
        memberIds: ["only-one"],
        requiredPower: 2,
        identityKey,
        signer,
      }),
    ).rejects.toThrow(/exactly 3 members/);
    // Fail-fast: no network work happens on bad input.
    expect(fetch).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
