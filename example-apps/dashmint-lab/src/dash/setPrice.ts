/**
 * Set (or remove) the sale price on a card.
 *
 * Pricing a card adds a `$price` field to the document on-chain, which is
 * what the Marketplace tab filters by. Passing price = 0n removes the
 * card from sale.
 *
 * SDK method: sdk.documents.setPrice({ document, price, identityKey, signer })
 */
import type { Logger } from "./logger";
import type { DashKeyManager, DashSdk } from "./types";
import { withAuthedCard } from "./withAuthedCard";

export interface SetPriceParams {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  cardId: string;
  /** Price in credits. Pass 0 to remove the card from sale. */
  price: number | bigint;
  log?: Logger;
}

export async function setPrice({
  sdk,
  keyManager,
  contractId,
  cardId,
  price,
  log,
}: SetPriceParams): Promise<void> {
  const priceBig = typeof price === "bigint" ? price : BigInt(price);
  const removing = priceBig === 0n;

  log?.(
    removing
      ? `Removing price from card ${cardId}…`
      : `Setting price ${priceBig} credits on card ${cardId}…`,
  );

  await withAuthedCard(
    {
      sdk,
      keyManager,
      contractId,
      cardId,
      errorLabel: removing ? "Remove price error" : "Set price error",
      log,
    },
    async ({ doc, identityKey, signer }) => {
      await sdk.documents.setPrice({
        document: doc,
        price: priceBig,
        identityKey,
        signer,
      });
      log?.(removing ? "Card removed from sale." : "Price set!", "success");
    },
  );
}
