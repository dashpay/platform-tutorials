/**
 * TokenOps token constants and read helpers.
 *
 * SDK methods: sdk.tokens.calculateId / totalSupply / statuses /
 * identityBalances / identityTokenInfos / contractInfo; sdk.contracts.fetch
 * for the localized name/description.
 */
import { TOKEN_POSITION } from "./contract";
import type { DashContractLike, DashSdk } from "./types";

export { TOKEN_POSITION };

export interface TokenMetadata {
  /**
   * Localized display name (English `singularForm`), already capitalized when
   * the token's `shouldCapitalize` convention is set. Empty string if the
   * contract exposes no conventions.
   */
  name: string;
  /** Free-text token description, or empty string when unset. */
  description: string;
}

export interface TokenSupplyConfig {
  /**
   * The initial supply minted to the contract owner at registration, read from
   * `tokens[pos].baseSupply`. Distinct from the live `totalSupply`, which also
   * includes anything minted since (manual mints, perpetual distribution). 0
   * when the config omits it.
   */
  baseSupply: bigint;
  /**
   * The token's fixed maximum supply, or `null` when the token is uncapped.
   * A capped meter (percent minted / remaining headroom) is only meaningful
   * when this is non-null. Read straight from the fetched contract's
   * `tokens[pos].maxSupply` — do NOT confuse with the static registration
   * default `TOKEN_MAX_SUPPLY`, which only describes contracts this app mints.
   */
  maxSupply: bigint | null;
  /**
   * True when `distributionRules.perpetualDistribution` is configured — the
   * token mints new supply on an ongoing schedule (block/time/epoch-based).
   * Such tokens commonly have no `maxSupply`.
   */
  hasPerpetualDistribution: boolean;
  /** True when `distributionRules.preProgrammedDistribution` is configured. */
  hasPreProgrammedDistribution: boolean;
}

function toBigIntOrNull(value: unknown): bigint | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && value.trim() !== "") {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Read the supply cap and distribution shape out of a fetched contract's token
 * config. The SDK serializes `tokens[pos].maxSupply` as a number (or `null`
 * when uncapped) and `tokens[pos].distributionRules` with nullable
 * `perpetualDistribution` / `preProgrammedDistribution` sub-objects.
 */
export function readTokenSupplyConfig(
  contract: DashContractLike | undefined,
  tokenPosition: number,
): TokenSupplyConfig {
  if (!contract) {
    return {
      baseSupply: 0n,
      maxSupply: null,
      hasPerpetualDistribution: false,
      hasPreProgrammedDistribution: false,
    };
  }
  const json = toJson(contract);
  const tokens = toJson(json.tokens);
  const tokenConfig = toJson(
    tokens[String(tokenPosition)] ?? tokens[tokenPosition],
  );
  const distribution = toJson(tokenConfig.distributionRules);
  return {
    baseSupply: toBigIntOrNull(tokenConfig.baseSupply) ?? 0n,
    maxSupply: toBigIntOrNull(tokenConfig.maxSupply),
    hasPerpetualDistribution: distribution.perpetualDistribution != null,
    hasPreProgrammedDistribution: distribution.preProgrammedDistribution != null,
  };
}

function toJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    const maybe = value as { toJSON?: () => unknown };
    const json = typeof maybe.toJSON === "function" ? maybe.toJSON() : value;
    if (json && typeof json === "object") {
      return json as Record<string, unknown>;
    }
  }
  return {};
}

/**
 * Pull the localized name and description out of a fetched contract's token
 * config. The SDK serializes conventions as
 * `tokens[pos].conventions.localizations.en` with `singularForm` /
 * `shouldCapitalize`, and the token `description` as a sibling string.
 */
export function readTokenMetadata(
  contract: DashContractLike | undefined,
  tokenPosition: number,
): TokenMetadata {
  if (!contract) return { name: "", description: "" };
  const json = toJson(contract);
  const tokens = toJson(json.tokens);
  const tokenConfig = toJson(
    tokens[String(tokenPosition)] ?? tokens[tokenPosition],
  );
  const description =
    typeof tokenConfig.description === "string" ? tokenConfig.description : "";

  // Prefer English, but fall back to whatever locale the token was published
  // with — a token localized only in another language still gets a name.
  const conventions = toJson(tokenConfig.conventions);
  const localizations = toJson(conventions.localizations);
  const en = toJson(localizations.en);
  const locale =
    typeof en.singularForm === "string"
      ? en
      : toJson(Object.values(localizations)[0]);
  const singular =
    typeof locale.singularForm === "string" ? locale.singularForm : "";
  const name =
    locale.shouldCapitalize === true && singular
      ? singular.charAt(0).toUpperCase() + singular.slice(1)
      : singular;

  return { name, description };
}

export async function fetchTokenId({
  sdk,
  contractId,
}: {
  sdk: DashSdk;
  contractId: string;
}): Promise<string> {
  return sdk.tokens.calculateId(contractId, TOKEN_POSITION);
}

export async function fetchTokenBalance({
  sdk,
  contractId,
  identityId,
}: {
  sdk: DashSdk;
  contractId: string;
  identityId: string;
}): Promise<bigint> {
  const tokenId = await fetchTokenId({ sdk, contractId });
  const balances = await sdk.tokens.identityBalances(identityId, [tokenId]);
  return balances.get(tokenId) ?? 0n;
}

export async function fetchIdentityTokenState({
  sdk,
  contractId,
  identityId,
}: {
  sdk: DashSdk;
  contractId: string;
  identityId: string;
}): Promise<{ balance: bigint; isFrozen: boolean }> {
  const tokenId = await fetchTokenId({ sdk, contractId });
  const [balances, infos] = await Promise.all([
    sdk.tokens.identityBalances(identityId, [tokenId]),
    sdk.tokens.identityTokenInfos(identityId, [tokenId]),
  ]);
  return {
    balance: balances.get(tokenId) ?? 0n,
    isFrozen: infos.get(tokenId)?.isFrozen ?? false,
  };
}

export async function fetchIdentityTokenStates({
  sdk,
  contractId,
  identityIds,
}: {
  sdk: DashSdk;
  contractId: string;
  identityIds: string[];
}): Promise<Map<string, { balance: bigint; isFrozen: boolean }>> {
  const tokenId = await fetchTokenId({ sdk, contractId });
  const uniqueIds = [
    ...new Set(identityIds.map((id) => id.trim()).filter(Boolean)),
  ];
  const entries = await Promise.all(
    uniqueIds.map(async (identityId) => {
      const [balances, infos] = await Promise.all([
        sdk.tokens.identityBalances(identityId, [tokenId]),
        sdk.tokens.identityTokenInfos(identityId, [tokenId]),
      ]);
      return [
        identityId,
        {
          balance: balances.get(tokenId) ?? 0n,
          isFrozen: infos.get(tokenId)?.isFrozen ?? false,
        },
      ] as const;
    }),
  );
  return new Map(entries);
}

export async function fetchTokenOverview({
  sdk,
  contractId,
}: {
  sdk: DashSdk;
  contractId: string;
}): Promise<{
  tokenId: string;
  totalSupply: bigint;
  isPaused: boolean;
  contractInfo: unknown;
  metadata: TokenMetadata;
  supplyConfig: TokenSupplyConfig;
}> {
  const tokenId = await fetchTokenId({ sdk, contractId });
  const [totalSupply, statuses, contractInfo, contract] = await Promise.all([
    sdk.tokens.totalSupply(tokenId),
    sdk.tokens.statuses([tokenId]),
    sdk.tokens.contractInfo(tokenId),
    sdk.contracts.fetch(contractId),
  ]);
  return {
    tokenId,
    totalSupply: totalSupply?.totalSupply ?? 0n,
    isPaused: statuses.get(tokenId)?.isPaused ?? false,
    contractInfo,
    metadata: readTokenMetadata(contract, TOKEN_POSITION),
    supplyConfig: readTokenSupplyConfig(contract, TOKEN_POSITION),
  };
}
