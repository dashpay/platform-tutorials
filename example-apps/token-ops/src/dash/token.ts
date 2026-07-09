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
  };
}
