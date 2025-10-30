/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/delete-documents.html
import setupEvoClient from '../../setupEvoClient.mjs';

const sdk = setupEvoClient();
await sdk.connect();

const deleteNFTCard = async () => {
  const identityId = process.env.IDENTITY_ID; // Your identity ID
  const contractId = process.env.NFT_CONTRACT_ID; // Your NFT contract ID
  const documentId = process.env.NFT_DOCUMENT_ID; // NFT card to delete
  const privateKeyWif = process.env.CRITICAL_KEY_WIF; // Identity's private key

  // Delete the NFT card document
  const result = await sdk.documents.delete({
    contractId,
    type: 'card',
    documentId,
    ownerId: identityId,
    privateKeyWif,
  });

  return result;
};

deleteNFTCard()
  .then((d) => console.log(d))
  .catch((e) => console.error('Something went wrong:\n', e.message))
  .finally(() => process.exit());
