/**
 * Burn a card — permanently delete the document from the Platform.
 *
 * Unlike the other mutations, burn does NOT need the full fetched Document:
 * the delete API only needs enough identifying fields to locate the target.
 * That's why withAuthedCard() is called with preFetch: false.
 *
 * SDK method: sdk.documents.delete({ document, identityKey, signer })
 */
import type { Logger } from "./logger";
import type { DashKeyManager, DashSdk } from "./types";
import { withAuthedCard } from "./withAuthedCard";

export interface BurnCardParams {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  cardId: string;
  log?: Logger;
}

export async function burnCard({
  sdk,
  keyManager,
  contractId,
  cardId,
  log,
}: BurnCardParams): Promise<void> {
  log?.(`Burning card ${cardId}…`);

  await withAuthedCard(
    {
      sdk,
      keyManager,
      contractId,
      cardId,
      preFetch: false,
      errorLabel: "Burn error",
      log,
    },
    async ({ identity, identityKey, signer }) => {
      await sdk.documents.delete({
        document: {
          id: cardId,
          ownerId: identity.id,
          dataContractId: contractId,
          documentTypeName: "card",
        },
        identityKey,
        signer,
      });
      log?.("Card burned.", "success");
    },
  );
}
