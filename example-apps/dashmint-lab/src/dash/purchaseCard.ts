/**
 * Purchase a priced card from another identity.
 *
 * The signed-in identity pays `price` credits and becomes the new owner.
 * Platform enforces the price server-side — passing a stale price fails.
 *
 * SDK method: sdk.documents.purchase({ document, buyerId, price, identityKey, signer })
 */
import type { Logger } from "./logger";
import { withAuthedCard } from "./withAuthedCard";

export interface PurchaseCardParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sdk: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  keyManager: any;
  contractId: string;
  cardId: string;
  /** Price in credits — must match the on-chain $price. */
  price: number | bigint;
  log?: Logger;
}

export async function purchaseCard({
  sdk,
  keyManager,
  contractId,
  cardId,
  price,
  log,
}: PurchaseCardParams): Promise<void> {
  const priceBig = typeof price === "bigint" ? price : BigInt(price);
  log?.(`Purchasing card ${cardId} for ${priceBig} credits…`);

  await withAuthedCard(
    {
      sdk,
      keyManager,
      contractId,
      cardId,
      errorLabel: "Purchase error",
      log,
    },
    async ({ doc, identity, identityKey, signer }) => {
      await sdk.documents.purchase({
        document: doc,
        buyerId: identity.id,
        price: priceBig,
        identityKey,
        signer,
      });
      log?.("Card purchased!", "success");
    },
  );
}
