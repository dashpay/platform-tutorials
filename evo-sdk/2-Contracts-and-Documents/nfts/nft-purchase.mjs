/* eslint-disable no-console */
// Purchase an NFT card that has been listed for sale on the marketplace
import setupEvoClient from '../../setupEvoClient.mjs';

const sdk = setupEvoClient();
await sdk.connect();

const purchaseNFT = async () => {
  const contractId = process.env.NFT_CONTRACT_ID; // NFT contract ID
  const documentId = process.env.NFT_DOCUMENT_ID; // Document ID to purchase
  const buyerId = process.env.NFT_BUYER_ID; // Buyer's identity ID
  const price = parseInt(process.env.NFT_PRICE, 10) || 1000; // Price in credits (must match document's set price)
  const privateKeyWif = process.env.NFT_BUYER_KEY_WIF; // Buyer's private key

  // Purchase the NFT card from the marketplace
  // The price must exactly match the document's current price
  const result = await sdk.documents.purchase({
    contractId,
    type: 'card',
    documentId,
    buyerId,
    price,
    privateKeyWif,
  });

  console.log(`Document ${documentId} purchased for ${price} credits`);
  return result;
};

purchaseNFT()
  .then((d) => console.log('Result:', d))
  .catch((e) => console.error('Something went wrong:\n', e.message))
  .finally(() => process.exit());
