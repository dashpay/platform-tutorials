/**
 * DashMint token constants and helpers.
 *
 * The data contract defines token position 0 as a fixed-supply DashMint token.
 * Creating a `card` document burns one token via `card.tokenCost.create`.
 * UI code uses this file to build tokenPaymentInfo and display the signed-in
 * identity's remaining DashMint token balance.
 */
import type { DashSdk } from "./types";

export const DASHMINT_TOKEN_POSITION = 0;
export const DASHMINT_TOKEN_COST = 1n;
export const DASHMINT_TOKEN_SUPPLY = 100n;
export const DASHMINT_TOKEN_NAME = "DashMint";
export const DASHMINT_TOKEN_PLURAL = "DashMint";

// Agreement passed to sdk.documents.create() to satisfy the contract's
// one-token burn requirement for card creation.
export const DASHMINT_TOKEN_PAYMENT_INFO = {
  tokenContractPosition: DASHMINT_TOKEN_POSITION,
  maximumTokenCost: DASHMINT_TOKEN_COST,
  gasFeesPaidBy: "documentOwner" as const,
};

export async function fetchDashMintTokenBalance({
  sdk,
  contractId,
  identityId,
}: {
  sdk: DashSdk;
  contractId: string;
  identityId: string;
}): Promise<bigint> {
  const tokenId = await sdk.tokens.calculateId(
    contractId,
    DASHMINT_TOKEN_POSITION,
  );
  const balances = await sdk.tokens.identityBalances(identityId, [tokenId]);
  return balances.get(tokenId) ?? 0n;
}
