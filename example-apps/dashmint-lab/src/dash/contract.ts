/**
 * NFT card data contract schema + registerContract / ensureContract.
 *
 * WHAT: A Dash Platform "data contract" defines the schema for documents.
 * This one describes a single document type (`card`) with four fields
 * (name, description, attack, defense) plus three indices so the app can
 * query by owner, attack, or defense.
 *
 * The three flags at the top of the schema are what make this an NFT:
 *   transferable: 1         — documents can be sent to another identity (0 to disable)
 *   tradeMode: 1            — documents can be priced and purchased (0 to disable)
 *   creationRestrictionMode: 0 — anyone can create when they can pay tokenCost.create
 *
 * tokenCost.create burns 1 DashMint token, turning the fixed token
 * supply into the maximum number of cards that can ever be minted.
 *
 * Storage helpers (loadStoredContractId, saveContractId, …) and the owner
 * lookup live in contractStorage.ts so they can be imported without
 * pulling the @dashevo/evo-sdk runtime into the entry bundle.
 *
 * SDK methods: new DataContract({ ... }), sdk.contracts.publish(...)
 */
import {
  AuthorizedActionTakers,
  ChangeControlRules,
  DataContract,
  TokenConfiguration,
  TokenConfigurationConvention,
  TokenConfigurationLocalization,
  TokenDistributionRules,
  TokenKeepsHistoryRules,
  TokenMarketplaceRules,
  TokenTradeMode,
} from "@dashevo/evo-sdk";

import { loadStoredContractId, saveContractId } from "./contractStorage";
import type { Logger } from "./logger";
import {
  DASHMINT_TOKEN_NAME,
  DASHMINT_TOKEN_PLURAL,
  DASHMINT_TOKEN_POSITION,
  DASHMINT_TOKEN_SUPPLY,
} from "./dashMintToken";
import type { DashKeyManager, DashSdk } from "./types";

export {
  DEFAULT_CONTRACT_ID,
  clearStoredContractId,
  fetchContractOwnerId,
  loadStoredContractId,
  saveContractId,
} from "./contractStorage";

export const CARD_SCHEMAS = {
  card: {
    type: "object",
    documentsMutable: false,
    canBeDeleted: true,
    transferable: 1,
    tradeMode: 1,
    creationRestrictionMode: 0,
    tokenCost: {
      create: {
        tokenPosition: DASHMINT_TOKEN_POSITION,
        amount: 1,
        effect: 1,
        gasFeesPaidBy: 0,
      },
    },
    properties: {
      name: {
        type: "string",
        description: "Name of the card",
        minLength: 1,
        maxLength: 63,
        position: 0,
      },
      description: {
        type: "string",
        description: "Description of the card",
        minLength: 0,
        maxLength: 256,
        position: 1,
      },
      attack: {
        type: "integer",
        description: "Attack power",
        position: 2,
      },
      defense: {
        type: "integer",
        description: "Defense level",
        position: 3,
      },
    },
    indices: [
      { name: "owner", properties: [{ $ownerId: "asc" }] },
      { name: "attack", properties: [{ attack: "asc" }] },
      { name: "defense", properties: [{ defense: "asc" }] },
    ],
    required: ["name", "attack", "defense"],
    additionalProperties: false,
  },
} as const;

export function createDashMintTokenConfiguration(ownerId: string) {
  const contractOwner = AuthorizedActionTakers.ContractOwner();
  const noOne = AuthorizedActionTakers.NoOne();

  const ownerRules = new ChangeControlRules({
    authorizedToMakeChange: contractOwner,
    adminActionTakers: contractOwner,
    isChangingAuthorizedActionTakersToNoOneAllowed: true,
    isChangingAdminActionTakersToNoOneAllowed: true,
    isSelfChangingAdminActionTakersAllowed: true,
  });
  const lockedRules = new ChangeControlRules({
    authorizedToMakeChange: noOne,
    adminActionTakers: noOne,
  });

  return new TokenConfiguration({
    conventions: new TokenConfigurationConvention(
      {
        en: new TokenConfigurationLocalization(
          false,
          DASHMINT_TOKEN_NAME,
          DASHMINT_TOKEN_PLURAL,
        ),
      },
      0,
    ),
    conventionsChangeRules: ownerRules,
    baseSupply: DASHMINT_TOKEN_SUPPLY,
    maxSupply: DASHMINT_TOKEN_SUPPLY,
    keepsHistory: new TokenKeepsHistoryRules({
      isKeepingBurningHistory: true,
      isKeepingTransferHistory: true,
    }),
    maxSupplyChangeRules: lockedRules,
    distributionRules: new TokenDistributionRules({
      newTokensDestinationIdentity: ownerId,
      newTokensDestinationIdentityRules: ownerRules,
      mintingAllowChoosingDestination: false,
      mintingAllowChoosingDestinationRules: ownerRules,
      perpetualDistributionRules: lockedRules,
      changeDirectPurchasePricingRules: lockedRules,
    }),
    marketplaceRules: new TokenMarketplaceRules(
      TokenTradeMode.NotTradeable(),
      lockedRules,
    ),
    manualMintingRules: lockedRules,
    manualBurningRules: lockedRules,
    freezeRules: lockedRules,
    unfreezeRules: lockedRules,
    destroyFrozenFundsRules: lockedRules,
    emergencyActionRules: lockedRules,
    mainControlGroupCanBeModified: noOne,
    description: "Fixed-supply DashMint token burned to mint demo cards.",
  });
}

/**
 * Register a fresh NFT card data contract on Platform and persist its ID.
 *
 * SDK methods: sdk.identities.nonce(...), sdk.contracts.publish(...).
 */
export async function registerContract({
  sdk,
  keyManager,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  log?: Logger;
}): Promise<string> {
  log?.("Registering NFT card contract…");
  const { identity, identityKey, signer } = await keyManager.getAuth();
  const identityNonce = await sdk.identities.nonce(identity.id.toString());
  const dataContract = new DataContract({
    ownerId: identity.id,
    identityNonce: (identityNonce || 0n) + 1n,
    schemas: CARD_SCHEMAS,
    tokens: {
      [DASHMINT_TOKEN_POSITION]: createDashMintTokenConfiguration(
        identity.id.toString(),
      ),
    },
    fullValidation: true,
  });

  log?.("Publishing contract…");
  const published = await sdk.contracts.publish({
    dataContract,
    identityKey,
    signer,
  });
  const contractId = published.id?.toString() || published.toJSON?.()?.id;

  if (!contractId) {
    throw new Error(
      `Contract publish returned no id: ${JSON.stringify(published.toJSON?.() ?? published)}`,
    );
  }

  saveContractId(contractId);
  log?.(`Contract registered: ${contractId}`, "success");
  return contractId;
}

/**
 * Ensure a card data contract exists for this app. If a contract ID is
 * already persisted in localStorage (or passed in), we reuse it. Otherwise
 * publish a fresh contract owned by the signed-in identity and persist its
 * ID for next time.
 */
export async function ensureContract({
  sdk,
  keyManager,
  existingId,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  existingId?: string | null;
  log?: Logger;
}): Promise<string> {
  const fromStorage = existingId ?? loadStoredContractId();
  if (fromStorage) {
    log?.(`Using saved contract ID: ${fromStorage}`);
    return fromStorage;
  }
  return registerContract({ sdk, keyManager, log });
}
