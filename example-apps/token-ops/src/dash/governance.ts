/**
 * Read TokenOps groups and token ChangeControlRules from a fetched contract.
 *
 * SDK methods: sdk.contracts.fetch / sdk.group.info / sdk.contracts.update.
 */
import { createTokenOpsGroup, GROUP_DEFINITIONS } from "./contract";
import { TOKEN_POSITION } from "./token";
import type { DashContractLike, DashSdk } from "./types";
import type { Logger } from "./logger";
import type { IdentityPublicKey, IdentitySigner } from "@dashevo/evo-sdk";

export interface TokenOpsGroupInfo {
  groupPosition: number;
  members: Map<string, number>;
  requiredPower: number;
}

export interface RuleAuthority {
  type:
    "ContractOwner" | "Group" | "Identity" | "MainGroup" | "NoOne" | "Unknown";
  groupPosition?: number;
  identityId?: string;
  raw?: unknown;
}

export interface RuleInfo {
  key: string;
  label: string;
  ruleName: string;
  operator: RuleAuthority;
  admin: RuleAuthority;
  canSetOperatorToNoOne: boolean;
  canSetAdminToNoOne: boolean;
  supportsGroupAction: boolean;
  configUpdateItem?: string;
  deferred?: boolean;
}

export interface TokenOpsGovernance {
  groups: TokenOpsGroupInfo[];
  rules: RuleInfo[];
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function toJsonRecord(value: unknown): UnknownRecord {
  if (isRecord(value) && typeof value.toJSON === "function") {
    const json = value.toJSON();
    return isRecord(json) ? json : {};
  }
  return isRecord(value) ? value : {};
}

function normalizeMembers(rawMembers: unknown): Map<string, number> {
  if (rawMembers instanceof Map) {
    return new Map(
      [...rawMembers.entries()].map(([id, power]) => [
        String(id),
        Number(power),
      ]),
    );
  }
  if (Array.isArray(rawMembers)) {
    return new Map(
      rawMembers.map((entry) => {
        if (Array.isArray(entry)) return [String(entry[0]), Number(entry[1])];
        const json = toJsonRecord(entry);
        return [
          String(json.id ?? json.identityId ?? json.identifier ?? ""),
          Number(json.power ?? json.weight ?? 1),
        ];
      }),
    );
  }
  if (isRecord(rawMembers)) {
    return new Map(
      Object.entries(rawMembers).map(([id, power]) => [
        id,
        Number(power as number | bigint | string),
      ]),
    );
  }
  return new Map();
}

function normalizeGroup(
  position: number,
  rawGroup: unknown,
): TokenOpsGroupInfo {
  const group = toJsonRecord(rawGroup);
  return {
    groupPosition: position,
    members: normalizeMembers(
      group.members ?? (rawGroup as TokenOpsGroupInfo)?.members,
    ),
    requiredPower: Number(group.requiredPower ?? group.required_power ?? 0),
  };
}

function normalizeGroups(rawGroups: unknown): TokenOpsGroupInfo[] {
  if (rawGroups instanceof Map) {
    return [...rawGroups.entries()]
      .map(([position, group]) => normalizeGroup(Number(position), group))
      .sort((a, b) => a.groupPosition - b.groupPosition);
  }
  if (!isRecord(rawGroups)) return [];
  return Object.entries(rawGroups)
    .map(([position, group]) => normalizeGroup(Number(position), group))
    .filter((group) => Number.isInteger(group.groupPosition))
    .sort((a, b) => a.groupPosition - b.groupPosition);
}

function tokenConfigFromContract(contract: DashContractLike): UnknownRecord {
  const rawTokens = contract.tokens;
  if (rawTokens instanceof Map)
    return toJsonRecord(rawTokens.get(TOKEN_POSITION));
  if (isRecord(rawTokens)) {
    const tokenRecord = rawTokens as Record<string, unknown>;
    return toJsonRecord(tokenRecord[String(TOKEN_POSITION)]);
  }
  const jsonTokens = toJsonRecord(contract).tokens;
  if (isRecord(jsonTokens)) {
    const tokenRecord = jsonTokens as Record<string, unknown>;
    return toJsonRecord(tokenRecord[String(TOKEN_POSITION)]);
  }
  return {};
}

function readAuthority(raw: unknown): RuleAuthority {
  if (typeof raw === "number")
    return { type: "Group", groupPosition: raw, raw };
  const record = toJsonRecord(raw);
  const text = String(
    record.type ??
      record.takerType ??
      record.actionTakerType ??
      record.__type ??
      "",
  ).toLowerCase();
  const value =
    record.groupContractPosition ??
    record.group_contract_position ??
    record.groupPosition ??
    record.position ??
    record.value;

  if (text.includes("contractowner")) return { type: "ContractOwner", raw };
  if (text.includes("maingroup")) return { type: "MainGroup", raw };
  if (text.includes("noone")) return { type: "NoOne", raw };
  if (text.includes("identity")) {
    return { type: "Identity", identityId: String(value ?? ""), raw };
  }
  if (text.includes("group") || typeof value === "number") {
    return {
      type: "Group",
      groupPosition:
        typeof value === "number"
          ? value
          : typeof value === "bigint"
            ? Number(value)
            : typeof value === "string" && /^\d+$/.test(value)
              ? Number(value)
              : undefined,
      raw,
    };
  }
  return { type: "Unknown", raw };
}

function readRule(tokenConfig: UnknownRecord, ruleName: string): UnknownRecord {
  return toJsonRecord(
    tokenConfig[ruleName] ??
      tokenConfig[`${ruleName}_rules`] ??
      tokenConfig[ruleName.replace("Rules", "_rules")],
  );
}

export const RULE_DEFINITIONS = [
  {
    key: "manualMinting",
    label: "Manual minting",
    ruleName: "manualMintingRules",
    supportsGroupAction: true,
    configUpdateItem: "ManualMintingItem",
  },
  {
    key: "manualBurning",
    label: "Manual burning",
    ruleName: "manualBurningRules",
    supportsGroupAction: true,
    configUpdateItem: "ManualBurningItem",
  },
  {
    key: "freeze",
    label: "Freeze",
    ruleName: "freezeRules",
    supportsGroupAction: true,
    configUpdateItem: "FreezeItem",
  },
  {
    key: "unfreeze",
    label: "Unfreeze",
    ruleName: "unfreezeRules",
    supportsGroupAction: true,
    configUpdateItem: "UnfreezeItem",
  },
  {
    key: "destroyFrozenFunds",
    label: "Destroy frozen funds",
    ruleName: "destroyFrozenFundsRules",
    supportsGroupAction: true,
    configUpdateItem: "DestroyFrozenFundsItem",
  },
  {
    key: "emergencyAction",
    label: "Emergency pause/resume",
    ruleName: "emergencyActionRules",
    supportsGroupAction: true,
    configUpdateItem: "EmergencyActionItem",
  },
  {
    key: "maxSupply",
    label: "Max supply",
    ruleName: "maxSupplyChangeRules",
    supportsGroupAction: false,
    deferred: true,
    configUpdateItem: "MaxSupplyItem",
  },
  {
    key: "conventions",
    label: "Token conventions/name",
    ruleName: "conventionsChangeRules",
    supportsGroupAction: false,
    deferred: true,
    configUpdateItem: "conventionsItem",
  },
  {
    key: "newTokensDestinationIdentity",
    label: "New token destination identity",
    ruleName: "newTokensDestinationIdentityRules",
    supportsGroupAction: false,
    deferred: true,
    configUpdateItem: "NewTokensDestinationIdentityItem",
  },
  {
    key: "mintingAllowChoosingDestination",
    label: "Minting can choose destination",
    ruleName: "mintingAllowChoosingDestinationRules",
    supportsGroupAction: false,
    deferred: true,
    configUpdateItem: "MintingAllowChoosingDestinationItem",
  },
  {
    key: "directPurchasePricing",
    label: "Direct purchase pricing",
    ruleName: "changeDirectPurchasePricingRules",
    supportsGroupAction: false,
    deferred: true,
  },
  {
    key: "marketplaceTradeMode",
    label: "Marketplace trade mode",
    ruleName: "tradeModeChangeRules",
    supportsGroupAction: false,
    deferred: true,
    configUpdateItem: "MarketplaceTradeModeItem",
  },
  {
    key: "perpetualDistribution",
    label: "Perpetual distribution",
    ruleName: "perpetualDistributionRules",
    supportsGroupAction: false,
    deferred: true,
    configUpdateItem: "PerpetualDistributionConfigurationItem",
  },
] as const;

function ruleSource(
  tokenConfig: UnknownRecord,
  definition: (typeof RULE_DEFINITIONS)[number],
) {
  if (
    definition.ruleName === "newTokensDestinationIdentityRules" ||
    definition.ruleName === "mintingAllowChoosingDestinationRules" ||
    definition.ruleName === "changeDirectPurchasePricingRules" ||
    definition.ruleName === "perpetualDistributionRules"
  ) {
    return readRule(
      toJsonRecord(tokenConfig.distributionRules),
      definition.ruleName,
    );
  }
  if (definition.ruleName === "tradeModeChangeRules") {
    return readRule(
      toJsonRecord(tokenConfig.marketplaceRules),
      definition.ruleName,
    );
  }
  return readRule(tokenConfig, definition.ruleName);
}

export function deriveRules(tokenConfig: UnknownRecord): RuleInfo[] {
  return RULE_DEFINITIONS.map((definition) => {
    const rule = ruleSource(tokenConfig, definition);
    return {
      ...definition,
      operator: readAuthority(
        rule.authorizedToMakeChange ??
          rule.authorized_to_make_change ??
          rule.authorizedActionTakers,
      ),
      admin: readAuthority(
        rule.adminActionTakers ??
          rule.admin_action_takers ??
          rule.adminActionTaker,
      ),
      canSetOperatorToNoOne: Boolean(
        rule.isChangingAuthorizedActionTakersToNoOneAllowed ??
        rule.is_changing_authorized_action_takers_to_no_one_allowed,
      ),
      canSetAdminToNoOne: Boolean(
        rule.isChangingAdminActionTakersToNoOneAllowed ??
        rule.is_changing_admin_action_takers_to_no_one_allowed,
      ),
    };
  });
}

async function fetchGroupIfMissing({
  sdk,
  contractId,
  position,
}: {
  sdk: DashSdk;
  contractId: string;
  position: number;
}): Promise<TokenOpsGroupInfo | null> {
  const group = await sdk.group.info(contractId, position);
  if (!group) return null;
  return {
    groupPosition: position,
    members: new Map(
      [...group.members.entries()].map(([id, power]) => [
        String(id),
        Number(power),
      ]),
    ),
    requiredPower: Number(group.requiredPower),
  };
}

export async function fetchTokenOpsGovernance({
  sdk,
  contractId,
}: {
  sdk: DashSdk;
  contractId: string;
  log?: Logger;
}): Promise<TokenOpsGovernance> {
  const contract = await sdk.contracts.fetch(contractId);
  if (!contract) throw new Error(`TokenOps contract ${contractId} not found`);

  const groupsByPosition = new Map<number, TokenOpsGroupInfo>(
    normalizeGroups(contract.groups ?? toJsonRecord(contract).groups).map(
      (group) => [group.groupPosition, group],
    ),
  );
  await Promise.all(
    Object.values(GROUP_DEFINITIONS).map(async ({ position }) => {
      if (groupsByPosition.has(position)) return;
      const group = await fetchGroupIfMissing({ sdk, contractId, position });
      if (group) groupsByPosition.set(position, group);
    }),
  );

  return {
    groups: [...groupsByPosition.values()].sort(
      (a, b) => a.groupPosition - b.groupPosition,
    ),
    rules: deriveRules(tokenConfigFromContract(contract)),
  };
}

export async function appendTokenOpsGroup({
  sdk,
  contractId,
  memberIds,
  requiredPower,
  identityKey,
  signer,
  log,
}: {
  sdk: DashSdk;
  contractId: string;
  memberIds: string[];
  requiredPower: number;
  identityKey: IdentityPublicKey | undefined;
  signer: IdentitySigner;
  log?: Logger;
}): Promise<number> {
  // Build (and thereby validate) the group before any network work, so bad
  // input fails fast without fetching the contract.
  const nextGroup = createTokenOpsGroup(memberIds, requiredPower);
  const contract = await sdk.contracts.fetch(contractId);
  if (!contract) throw new Error(`TokenOps contract ${contractId} not found`);
  const existingGroups = normalizeGroups(
    contract.groups ?? toJsonRecord(contract).groups,
  );
  const nextPosition =
    existingGroups.length === 0
      ? 0
      : Math.max(...existingGroups.map((group) => group.groupPosition)) + 1;
  const rawGroups = contract.groups;
  if (rawGroups instanceof Map) {
    rawGroups.set(nextPosition, nextGroup);
  } else {
    contract.groups = {
      ...(isRecord(rawGroups) ? rawGroups : {}),
      [nextPosition]: nextGroup,
    };
  }
  contract.version =
    Number(contract.version ?? toJsonRecord(contract).version ?? 1) + 1;
  log?.(`Appending TokenOps group ${nextPosition}...`);
  await sdk.contracts.update({ dataContract: contract, identityKey, signer });
  log?.(`TokenOps group ${nextPosition} added.`, "success");
  return nextPosition;
}

export function formatAuthority(authority: RuleAuthority): string {
  if (authority.type === "Group")
    return `Group ${authority.groupPosition ?? "?"}`;
  if (authority.type === "Identity")
    return `Identity ${authority.identityId ?? "?"}`;
  return authority.type;
}
