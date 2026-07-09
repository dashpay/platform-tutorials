/**
 * Resolve a pasted identifier — which may be a data contract ID *or* a token
 * ID — into the data contract ID the app runs on.
 *
 * Contract IDs and token IDs are both 32-byte base58 identifiers, so they are
 * indistinguishable by format. Resolution is behavioral: `sdk.tokens.contractInfo`
 * is the reverse of `sdk.tokens.calculateId` and returns `undefined` for a data
 * contract ID (per the SDK docs), which makes it a clean discriminator.
 *
 * TokenOps only ever creates one token, at position 0, so the app keys
 * everything off the contract ID and assumes position 0. When a pasted token ID
 * resolves to a different position, `tokenPosition` is surfaced so the caller
 * can warn rather than silently point the app at the wrong token.
 */
import { TOKEN_POSITION } from "./contract";
import type { DashSdk } from "./types";

export interface ResolvedTokenRef {
  contractId: string;
  /** Which kind of ID the user actually pasted. */
  resolvedFrom: "token" | "contract";
  /** Token ID that was pasted (only when resolvedFrom === "token"). */
  tokenId?: string;
  /**
   * Position of the resolved token within its contract. The app operates on
   * TOKEN_POSITION; a different value means the pasted token lives elsewhere on
   * a multi-token contract and the app can't drive it.
   */
  tokenPosition: number;
}

/** Stringify an SDK identifier (getter may return an IdentifierWasm). */
function idToString(value: string | { toString(): string }): string {
  return typeof value === "string" ? value : String(value);
}

export async function resolveTokenRef(
  sdk: DashSdk,
  input: string,
): Promise<ResolvedTokenRef> {
  const ref = input.trim();
  if (!ref) throw new Error("Enter a contract or token ID.");

  // 1) Assume it's a token ID. contractInfo returns undefined for a contract ID.
  const asToken = await sdk.tokens.contractInfo(ref);
  if (asToken) {
    return {
      contractId: idToString(asToken.contractId),
      resolvedFrom: "token",
      tokenId: ref,
      tokenPosition: asToken.tokenContractPosition,
    };
  }

  // 2) Fall back to treating it as a contract ID, then verify its primary token
  //    exists on-chain.
  const tokenId = await sdk.tokens.calculateId(ref, TOKEN_POSITION);
  const asContract = await sdk.tokens.contractInfo(tokenId);
  if (asContract) {
    return {
      contractId: ref,
      resolvedFrom: "contract",
      tokenPosition: asContract.tokenContractPosition,
    };
  }

  throw new Error(
    "Not a recognized TokenOps contract or token ID. Check the value and try again.",
  );
}
