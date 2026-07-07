import { describe, expect, it } from "vitest";

describe("deriveRules", () => {
  it("reads operator and admin authorities separately", async () => {
    const { deriveRules } = await import("../src/dash/governance");
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

  it("includes deferred config rows in the matrix", async () => {
    const { deriveRules } = await import("../src/dash/governance");
    const keys = deriveRules({}).map((rule) => rule.key);
    expect(keys).toContain("directPurchasePricing");
    expect(keys).toContain("perpetualDistribution");
    expect(keys).toContain("marketplaceTradeMode");
  });
});
