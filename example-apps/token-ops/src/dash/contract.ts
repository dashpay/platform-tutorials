/**
 * TokenOps data contract + group-governed token configuration.
 *
 * The app exists to make ChangeControlRules visible. Each token capability has
 * an operator (`authorizedToMakeChange`) and an admin (`adminActionTakers`).
 * The operator performs the token action; the admin can later reassign that
 * operator through token config updates.
 */
import { loadStoredContractId, saveContractId } from "./contractStorage";
import type { Logger } from "./logger";
import { loadSdkModule } from "./sdkModule";
import type { DashKeyManager, DashSdk } from "./types";

export {
  DEFAULT_CONTRACT_ID,
  clearStoredContractId,
  fetchContractOwnerId,
  loadStoredContractId,
  saveContractId,
} from "./contractStorage";

export const TOKEN_POSITION = 0;
export const TOKEN_NAME = "TokenOps";
export const TOKEN_PLURAL = "TokenOps";
export const TOKEN_BASE_SUPPLY = 100n;
export const TOKEN_MAX_SUPPLY = 10_000n;

export const TREASURY_GROUP_POSITION = 0;
export const ACCESS_GROUP_POSITION = 1;
export const EMERGENCY_GROUP_POSITION = 2;

// Platform group-size bounds (rs-dpp GroupV0::validate): a group needs at least
// 2 members and no more than `system_limits.max_contract_group_size` (256).
export const MIN_GROUP_MEMBERS = 2;
export const MAX_GROUP_MEMBERS = 256;

export const GROUP_DEFINITIONS = {
  treasury: {
    position: TREASURY_GROUP_POSITION,
    requiredPower: 2,
    label: "Treasury Group",
    description: "Mints and burns demo token supply.",
  },
  access: {
    position: ACCESS_GROUP_POSITION,
    requiredPower: 2,
    label: "Access Group",
    description: "Freezes and unfreezes identity token balances.",
  },
  emergency: {
    position: EMERGENCY_GROUP_POSITION,
    requiredPower: 3,
    label: "Emergency Group",
    description: "Pauses/resumes the token and destroys frozen funds.",
  },
} as const;

export type GroupKind = keyof typeof GROUP_DEFINITIONS;

export type TokenActionKind =
  "mint" | "burn" | "freeze" | "unfreeze" | "destroyFrozen" | "emergency";

export type ReassignableRuleKind =
  | "manualMinting"
  | "manualBurning"
  | "freeze"
  | "unfreeze"
  | "destroyFrozenFunds"
  | "emergencyAction";

export const DEFAULT_ACTION_GROUP_POSITIONS: Record<TokenActionKind, number> = {
  mint: TREASURY_GROUP_POSITION,
  burn: TREASURY_GROUP_POSITION,
  freeze: ACCESS_GROUP_POSITION,
  unfreeze: ACCESS_GROUP_POSITION,
  destroyFrozen: EMERGENCY_GROUP_POSITION,
  emergency: EMERGENCY_GROUP_POSITION,
};

export const PLACEHOLDER_SCHEMAS = {
  note: {
    type: "object",
    documentsMutable: false,
    canBeDeleted: false,
    properties: {
      message: {
        type: "string",
        maxLength: 128,
        position: 0,
      },
    },
    required: ["message"],
    additionalProperties: false,
  },
} as const;

export async function createRulePresets(ownerId: string) {
  const { AuthorizedActionTakers, ChangeControlRules } = await loadSdkModule();
  const contractOwner = AuthorizedActionTakers.ContractOwner();
  const noOne = AuthorizedActionTakers.NoOne();
  const treasuryGroup = AuthorizedActionTakers.Group(TREASURY_GROUP_POSITION);
  const accessGroup = AuthorizedActionTakers.Group(ACCESS_GROUP_POSITION);
  const emergencyGroup = AuthorizedActionTakers.Group(EMERGENCY_GROUP_POSITION);

  const ownerRules = new ChangeControlRules({
    authorizedToMakeChange: contractOwner,
    adminActionTakers: contractOwner,
    isChangingAuthorizedActionTakersToNoOneAllowed: false,
    isChangingAdminActionTakersToNoOneAllowed: false,
    isSelfChangingAdminActionTakersAllowed: true,
  });
  const lockedRules = new ChangeControlRules({
    authorizedToMakeChange: noOne,
    adminActionTakers: noOne,
  });
  const treasuryRules = new ChangeControlRules({
    authorizedToMakeChange: treasuryGroup,
    adminActionTakers: contractOwner,
    isChangingAuthorizedActionTakersToNoOneAllowed: false,
    isChangingAdminActionTakersToNoOneAllowed: false,
    isSelfChangingAdminActionTakersAllowed: true,
  });
  const accessRules = new ChangeControlRules({
    authorizedToMakeChange: accessGroup,
    adminActionTakers: contractOwner,
    isChangingAuthorizedActionTakersToNoOneAllowed: false,
    isChangingAdminActionTakersToNoOneAllowed: false,
    isSelfChangingAdminActionTakersAllowed: true,
  });
  const emergencyRules = new ChangeControlRules({
    authorizedToMakeChange: emergencyGroup,
    adminActionTakers: contractOwner,
    isChangingAuthorizedActionTakersToNoOneAllowed: false,
    isChangingAdminActionTakersToNoOneAllowed: false,
    isSelfChangingAdminActionTakersAllowed: true,
  });

  return {
    ownerId,
    lockedRules,
    ownerRules,
    treasuryRules,
    accessRules,
    emergencyRules,
  };
}

export async function createTokenOpsTokenConfiguration(ownerId: string) {
  const {
    AuthorizedActionTakers,
    TokenConfiguration,
    TokenConfigurationConvention,
    TokenConfigurationLocalization,
    TokenDistributionRules,
    TokenKeepsHistoryRules,
    TokenMarketplaceRules,
    TokenTradeMode,
  } = await loadSdkModule();
  const {
    lockedRules,
    ownerRules,
    treasuryRules,
    accessRules,
    emergencyRules,
  } = await createRulePresets(ownerId);

  return new TokenConfiguration({
    conventions: new TokenConfigurationConvention(
      {
        en: new TokenConfigurationLocalization(false, TOKEN_NAME, TOKEN_PLURAL),
      },
      0,
    ),
    conventionsChangeRules: ownerRules,
    baseSupply: TOKEN_BASE_SUPPLY,
    maxSupply: TOKEN_MAX_SUPPLY,
    keepsHistory: new TokenKeepsHistoryRules({
      isKeepingBurningHistory: true,
      isKeepingDirectPricingHistory: true,
      isKeepingDirectPurchaseHistory: true,
      isKeepingFreezingHistory: true,
      isKeepingMintingHistory: true,
      isKeepingTransferHistory: true,
    }),
    isStartedAsPaused: false,
    isAllowedTransferToFrozenBalance: false,
    maxSupplyChangeRules: ownerRules,
    distributionRules: new TokenDistributionRules({
      newTokensDestinationIdentity: ownerId,
      newTokensDestinationIdentityRules: ownerRules,
      mintingAllowChoosingDestination: true,
      mintingAllowChoosingDestinationRules: ownerRules,
      perpetualDistributionRules: lockedRules,
      changeDirectPurchasePricingRules: lockedRules,
    }),
    marketplaceRules: new TokenMarketplaceRules(
      TokenTradeMode.NotTradeable(),
      lockedRules,
    ),
    manualMintingRules: treasuryRules,
    manualBurningRules: treasuryRules,
    freezeRules: accessRules,
    unfreezeRules: accessRules,
    destroyFrozenFundsRules: emergencyRules,
    emergencyActionRules: emergencyRules,
    mainControlGroup: TREASURY_GROUP_POSITION,
    mainControlGroupCanBeModified: AuthorizedActionTakers.NoOne(),
    description:
      "TokenOps demo token with group-governed mint, burn, access, and emergency controls.",
  });
}

// Builds a group of any Platform-valid size. Every member gets power 1, so
// `requiredPower` is the signature threshold and must be 1..memberCount.
export async function buildTokenOpsGroup(
  memberIds: string[],
  requiredPower: number,
) {
  const cleanIds = memberIds.map((id) => id.trim()).filter(Boolean);
  if (
    cleanIds.length < MIN_GROUP_MEMBERS ||
    cleanIds.length > MAX_GROUP_MEMBERS
  ) {
    throw new Error(
      `TokenOps groups need ${MIN_GROUP_MEMBERS}-${MAX_GROUP_MEMBERS} members, got ${cleanIds.length}`,
    );
  }
  if (new Set(cleanIds).size !== cleanIds.length) {
    throw new Error("TokenOps group members must be distinct identities.");
  }
  if (
    !Number.isInteger(requiredPower) ||
    requiredPower < 1 ||
    requiredPower > cleanIds.length
  ) {
    throw new Error(
      `TokenOps group required power must be 1-${cleanIds.length}, got ${requiredPower}`,
    );
  }
  // Load the SDK only after validation so malformed input fails fast with the
  // validation error, not a chunk-fetch error (mirrors appendTokenOpsGroup's
  // "validate before network work" intent).
  const { Group } = await loadSdkModule();
  return new Group(new Map(cleanIds.map((id) => [id, 1])), requiredPower);
}

export async function createTokenOpsGroup(
  memberIds: string[],
  requiredPower: number,
) {
  const cleanIds = memberIds.map((id) => id.trim()).filter(Boolean);
  if (cleanIds.length !== 3) {
    throw new Error(
      `TokenOps groups need exactly 3 members, got ${cleanIds.length}`,
    );
  }
  return buildTokenOpsGroup(cleanIds, requiredPower);
}

export async function createTokenOpsGroups(memberIds: string[]) {
  const [treasury, access, emergency] = await Promise.all([
    createTokenOpsGroup(memberIds, GROUP_DEFINITIONS.treasury.requiredPower),
    createTokenOpsGroup(memberIds, GROUP_DEFINITIONS.access.requiredPower),
    createTokenOpsGroup(memberIds, GROUP_DEFINITIONS.emergency.requiredPower),
  ]);
  return {
    [TREASURY_GROUP_POSITION]: treasury,
    [ACCESS_GROUP_POSITION]: access,
    [EMERGENCY_GROUP_POSITION]: emergency,
  };
}

export async function registerContract({
  sdk,
  keyManager,
  groupMemberIds,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  groupMemberIds: string[];
  log?: Logger;
}): Promise<string> {
  log?.("Registering TokenOps contract...");
  const { DataContract } = await loadSdkModule();
  const { identity, identityKey, signer } = await keyManager.getAuth();
  const ownerId = identity.id.toString();
  const identityNonce = await sdk.identities.nonce(ownerId);
  const dataContract = new DataContract({
    ownerId: identity.id,
    identityNonce: (identityNonce || 0n) + 1n,
    schemas: PLACEHOLDER_SCHEMAS,
    tokens: {
      [TOKEN_POSITION]: await createTokenOpsTokenConfiguration(ownerId),
    },
    fullValidation: true,
  });

  dataContract.groups = await createTokenOpsGroups(groupMemberIds);

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
  log?.(`TokenOps contract registered: ${contractId}`, "success");
  return contractId;
}

export async function ensureContract({
  sdk,
  keyManager,
  existingId,
  groupMemberIds,
  log,
}: {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  existingId?: string | null;
  groupMemberIds: string[];
  log?: Logger;
}): Promise<string> {
  const fromStorage = existingId ?? loadStoredContractId();
  if (fromStorage) {
    log?.(`Using saved contract ID: ${fromStorage}`);
    return fromStorage;
  }
  return registerContract({ sdk, keyManager, groupMemberIds, log });
}
