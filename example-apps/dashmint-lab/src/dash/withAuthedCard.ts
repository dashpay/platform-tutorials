/**
 * Shared prelude for card mutations (transfer / setPrice / purchase / burn).
 *
 * Every mutation on an NFT card follows the same four steps:
 *   1. Get an auth signer for the current identity.
 *   2. Fetch the current on-chain Document (needed to know its revision).
 *   3. Bump `document.revision` by 1 — Platform rejects mutations that
 *      don't strictly increase the revision number.
 *   4. Call the SDK method (transfer/setPrice/purchase/delete).
 *
 * withAuthedCard() wraps steps 1-3 so the individual operation files stay
 * focused on the one SDK call that's unique to them. Pass `preFetch: false`
 * for burn (delete), which doesn't need the full fetched document.
 *
 * Ported from the original tutorial HTML:
 *   tutorial/nft/nft-collectibles.html:767 (`async function withAuthedCard`)
 *
 * SDK methods inside: keyManager.getAuth(), sdk.documents.get(...)
 */
import { errorMessage, type Logger } from './logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sdk = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KeyManager = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocumentLike = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IdentityLike = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IdentityKeyLike = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SignerLike = any;

export interface AuthedCardContext {
  sdk: Sdk;
  identity: IdentityLike;
  identityKey: IdentityKeyLike;
  signer: SignerLike;
  contractId: string;
  /** Present when preFetch !== false. Already has its revision incremented. */
  doc?: DocumentLike;
}

export interface WithAuthedCardOptions {
  sdk: Sdk;
  keyManager: KeyManager;
  contractId: string;
  cardId: string;
  /** Default true. Set to false for burn, which only needs identity + signer. */
  preFetch?: boolean;
  /** Label used in error messages, e.g. "Transfer error". Default "Error". */
  errorLabel?: string;
  log?: Logger;
}

export async function withAuthedCard<T>(
  opts: WithAuthedCardOptions,
  fn: (ctx: AuthedCardContext) => Promise<T>,
): Promise<T | undefined> {
  const {
    sdk,
    keyManager,
    contractId,
    cardId,
    preFetch = true,
    errorLabel = 'Error',
    log,
  } = opts;

  try {
    const { identity, identityKey, signer } = await keyManager.getAuth();
    const ctx: AuthedCardContext = {
      sdk,
      identity,
      identityKey,
      signer,
      contractId,
    };

    if (preFetch) {
      const doc = await sdk.documents.get(contractId, 'card', cardId);
      doc.revision = BigInt(doc.revision) + 1n;
      ctx.doc = doc;
    }

    return await fn(ctx);
  } catch (e) {
    const message = errorMessage(e);
    log?.(`${errorLabel}: ${message}`, 'error');
    // eslint-disable-next-line no-console
    console.error(e);
    return undefined;
  }
}
