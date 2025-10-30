/* eslint-disable no-console */
// Set a price for an NFT card to list it on the marketplace
import setupEvoClient from '../../setupEvoClient.mjs';

const sdk = setupEvoClient();
await sdk.connect();

const setPriceForNFT = async () => {
  const contractId = process.env.NFT_CONTRACT_ID; // NFT contract ID
  const documentId = process.env.NFT_DOCUMENT_ID; // Document ID to price
  const ownerId = process.env.NFT_OWNER_ID; // Owner's identity ID
  const price = parseInt(process.env.NFT_PRICE, 10) || 1000; // Price in credits (1000 = 1 satoshi equivalent)
  const privateKeyWif = process.env.CRITICAL_KEY_WIF; // Owner's private key

  // Set the price for the NFT card
  // Setting price to 0 will remove the marketplace listing
  const result = await sdk.documents.setPrice({
    contractId,
    type: 'card',
    documentId,
    ownerId,
    price,
    privateKeyWif,
  });

  console.log(`Price set to ${price} credits for document: ${documentId}`);
  return result;
};

setPriceForNFT()
  .then((d) => console.log('Result:', d))
  .catch((e) => console.error('Something went wrong:\n', e.message))
  .finally(() => process.exit());
