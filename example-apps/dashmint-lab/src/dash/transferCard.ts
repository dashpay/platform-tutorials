/**
 * Transfer a card (NFT document) to another identity.
 *
 * Gotcha (see tutorial/nft/CLAUDE.md): transfer uses the AUTHENTICATION
 * key, not the TRANSFER purpose key. The Platform rejects TRANSFER-purpose
 * keys for document state transitions.
 *
 * SDK method: sdk.documents.transfer({ document, recipientId, identityKey, signer })
 */
import type { Logger } from "./logger";
import { withAuthedCard } from "./withAuthedCard";

export interface TransferCardParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sdk: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  keyManager: any;
  contractId: string;
  cardId: string;
  recipientId: string;
  log?: Logger;
}

export async function transferCard({
  sdk,
  keyManager,
  contractId,
  cardId,
  recipientId,
  log,
}: TransferCardParams): Promise<void> {
  if (!recipientId) throw new Error("Recipient identity ID is required.");
  log?.(`Transferring card ${cardId} to ${recipientId}…`);

  await withAuthedCard(
    { sdk, keyManager, contractId, cardId, errorLabel: "Transfer error", log },
    async ({ doc, identityKey, signer }) => {
      await sdk.documents.transfer({
        document: doc,
        recipientId,
        identityKey,
        signer,
      });
      log?.("Card transferred!", "success");
    },
  );
}
