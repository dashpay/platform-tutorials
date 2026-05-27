import { describe, expect, it, vi } from "vitest";

const { mockDocumentCtor } = vi.hoisted(() => ({
  mockDocumentCtor: vi.fn(function MockDocument(
    this: Record<string, unknown>,
    args: Record<string, unknown>,
  ) {
    Object.assign(this, args);
  }),
}));

vi.mock("@dashevo/evo-sdk", () => ({
  Document: mockDocumentCtor,
  DataContract: class DataContract {},
  AuthorizedActionTakers: {
    ContractOwner: () => ({ type: "ContractOwner" }),
    NoOne: () => ({ type: "NoOne" }),
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

describe("token-paid minting", () => {
  it("defines card creation as a one-token burn", async () => {
    const { CARD_SCHEMAS } = await import("../src/dash/contract");
    const { DASHMINT_TOKEN_POSITION } =
      await import("../src/dash/dashMintToken");

    expect(CARD_SCHEMAS.card.creationRestrictionMode).toBe(0);
    expect(CARD_SCHEMAS.card.tokenCost.create).toEqual({
      tokenPosition: DASHMINT_TOKEN_POSITION,
      amount: 1,
      effect: 1,
      gasFeesPaidBy: 0,
    });
  });

  it("uses Platform-valid token names without whitespace", async () => {
    const { DASHMINT_TOKEN_NAME, DASHMINT_TOKEN_PLURAL } =
      await import("../src/dash/dashMintToken");

    expect(DASHMINT_TOKEN_NAME).toBe("DashMint");
    expect(DASHMINT_TOKEN_PLURAL).toBe("DashMint");
    expect(DASHMINT_TOKEN_NAME).not.toMatch(/[\s\p{C}]/u);
    expect(DASHMINT_TOKEN_PLURAL).not.toMatch(/[\s\p{C}]/u);
  });

  it("passes tokenPaymentInfo when minting a card", async () => {
    const { mintCard } = await import("../src/dash/mintCard");
    const { DASHMINT_TOKEN_PAYMENT_INFO } =
      await import("../src/dash/dashMintToken");
    const identity = { id: "identity-1" };
    const identityKey = { id: "key-1" };
    const signer = { id: "signer-1" };
    const create = vi.fn().mockResolvedValue(undefined);
    const log = vi.fn();

    await mintCard({
      sdk: { documents: { create } } as never,
      keyManager: {
        async getAuth() {
          return { identity, identityKey, signer };
        },
      } as never,
      contractId: "contract-1",
      card: { name: "Sky Hunter", description: "Fast and bright." },
      log,
    });

    expect(mockDocumentCtor).toHaveBeenCalledWith({
      properties: {
        name: "Sky Hunter",
        attack: expect.any(Number),
        defense: expect.any(Number),
        description: "Fast and bright.",
      },
      documentTypeName: "card",
      dataContractId: "contract-1",
      ownerId: identity.id,
    });
    expect(create).toHaveBeenCalledWith({
      document: mockDocumentCtor.mock.instances[0],
      identityKey,
      signer,
      tokenPaymentInfo: DASHMINT_TOKEN_PAYMENT_INFO,
    });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("Burning 1 DashMint token"),
    );
  });
});
