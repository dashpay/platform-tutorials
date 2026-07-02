/**
 * Researcher Credit token constants and helpers.
 *
 * The data contract defines token position 0 as the "Researcher Credit"
 * token. Submitting a `report` document transfers 1 credit to the contract
 * owner via `report.tokenCost.create` (a non-refundable filing fee — see
 * contract.ts for why `effect` is TransferTokenToContractOwner and not
 * BurnToken). Separately, a researcher's *remaining* credit balance is what
 * the triage panel can freeze and, on confirmed bad faith, destroy — see
 * freezeCredit.ts / destroyFrozenCredit.ts.
 */
import type { DashSdk } from "./types";

export const RESEARCHER_CREDIT_POSITION = 0;
export const RESEARCHER_CREDIT_SUBMISSION_COST = 1n;
export const RESEARCHER_CREDIT_BASE_SUPPLY = 100n;
export const RESEARCHER_CREDIT_NAME = "ResearcherCredit";
export const RESEARCHER_CREDIT_PLURAL = "ResearcherCredits";

// Agreement passed to sdk.documents.create() to satisfy the contract's
// 1-credit filing fee for report submission.
export const RESEARCHER_CREDIT_PAYMENT_INFO = {
  tokenContractPosition: RESEARCHER_CREDIT_POSITION,
  maximumTokenCost: RESEARCHER_CREDIT_SUBMISSION_COST,
  gasFeesPaidBy: "documentOwner" as const,
};

export async function fetchResearcherCreditTokenId({
  sdk,
  contractId,
}: {
  sdk: DashSdk;
  contractId: string;
}): Promise<string> {
  return sdk.tokens.calculateId(contractId, RESEARCHER_CREDIT_POSITION);
}

export async function fetchCreditBalance({
  sdk,
  contractId,
  identityId,
}: {
  sdk: DashSdk;
  contractId: string;
  identityId: string;
}): Promise<bigint> {
  const tokenId = await fetchResearcherCreditTokenId({ sdk, contractId });
  const balances = await sdk.tokens.identityBalances(identityId, [tokenId]);
  return balances.get(tokenId) ?? 0n;
}
