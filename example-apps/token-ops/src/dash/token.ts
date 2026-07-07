/**
 * TokenOps token constants and read helpers.
 *
 * SDK methods: sdk.tokens.calculateId / totalSupply / statuses /
 * identityBalances / identityTokenInfos / contractInfo.
 */
import { TOKEN_POSITION } from "./contract";
import type { DashSdk } from "./types";

export { TOKEN_POSITION };

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
}> {
  const tokenId = await fetchTokenId({ sdk, contractId });
  const [totalSupply, statuses, contractInfo] = await Promise.all([
    sdk.tokens.totalSupply(tokenId),
    sdk.tokens.statuses([tokenId]),
    sdk.tokens.contractInfo(tokenId),
  ]);
  return {
    tokenId,
    totalSupply: totalSupply?.totalSupply ?? 0n,
    isPaused: statuses.get(tokenId)?.isPaused ?? false,
    contractInfo,
  };
}
