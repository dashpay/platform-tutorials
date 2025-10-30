/* eslint-disable no-console */
// Transfer ownership of an NFT card to another identity
import setupEvoClient from '../../setupEvoClient.mjs';

const sdk = setupEvoClient();
await sdk.connect();

const transferNFT = async () => {
  const contractId = process.env.NFT_CONTRACT_ID; // NFT contract ID
  const documentId = process.env.NFT_DOCUMENT_ID; // Document ID to transfer
  const ownerId = process.env.NFT_OWNER_ID; // Current owner's identity ID
  const recipientId = process.env.NFT_RECIPIENT_ID; // Recipient's identity ID
  const privateKeyWif = process.env.CRITICAL_KEY_WIF; // Owner's private key

  // Transfer the NFT card to the recipient
  const result = await sdk.documents.transfer({
    contractId,
    type: 'card',
    documentId,
    ownerId,
    recipientId,
    privateKeyWif,
  });

  console.log(`Document ${documentId} transferred to ${recipientId}`);
  return result;
};

transferNFT()
  .then((d) => console.log('Result:', d))
  .catch((e) => console.error('Something went wrong:\n', e.message))
  .finally(() => process.exit());
