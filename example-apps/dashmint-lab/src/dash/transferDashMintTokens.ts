/**
 * Transfer DashMint tokens from the signed-in identity to another identity.
 *
 * DashMint lives at token position 0 on the active app contract. Token
 * single-transfer transitions can be signed by a critical auth or transfer
 * purpose key; this app keeps explicit token sends on the transfer key.
 *
 * SDK method: sdk.tokens.transfer({ dataContractId, tokenPosition, amount, senderId, recipientId, identityKey, signer })
 */
import { DASHMINT_TOKEN_NAME, DASHMINT_TOKEN_POSITION } from "./dashMintToken";
import type { Logger } from "./logger";
import type { DashKeyManager, DashSdk } from "./types";

export interface TransferDashMintTokensInput {
  sdk: DashSdk;
  keyManager: DashKeyManager;
  contractId: string;
  recipientId: string;
  amount: bigint;
  log?: Logger;
}

export async function transferDashMintTokens({
  sdk,
  keyManager,
  contractId,
  recipientId,
  amount,
  log,
}: TransferDashMintTokensInput): Promise<void> {
  const trimmedRecipientId = recipientId.trim();
  if (!trimmedRecipientId) {
    throw new Error("Recipient identity ID is required.");
  }
  if (amount <= 0n) {
    throw new Error("Amount must be greater than 0.");
  }

  const knownSenderId = keyManager.identityId?.toString();
  if (knownSenderId && trimmedRecipientId === knownSenderId) {
    throw new Error("Cannot transfer tokens to yourself.");
  }

  const { identity, identityKey, signer } = await keyManager.getTransfer();
  const senderId = identity.id.toString();
  if (trimmedRecipientId === senderId) {
    throw new Error("Cannot transfer tokens to yourself.");
  }

  log?.(
    `Transferring ${amount.toString()} ${DASHMINT_TOKEN_NAME} token${
      amount === 1n ? "" : "s"
    }...`,
  );

  await sdk.tokens.transfer({
    dataContractId: contractId,
    tokenPosition: DASHMINT_TOKEN_POSITION,
    amount,
    senderId,
    recipientId: trimmedRecipientId,
    identityKey,
    signer,
  });

  log?.(`${DASHMINT_TOKEN_NAME} tokens transferred.`, "success");
}
