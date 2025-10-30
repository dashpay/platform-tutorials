/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/retrieve-documents.html
import setupEvoClient from '../../setupEvoClient.mjs';

const sdk = setupEvoClient();
await sdk.connect();

const getDocuments = async () => {
  const contractId = process.env.NFT_CONTRACT_ID; // Your NFT contract ID

  return sdk.documents.query({
    contractId,
    type: 'card',
    limit: 2, // Only retrieve 2 documents
  });
};

getDocuments()
  .then((d) => {
    for (const doc of d) {
      console.log('NFT Card:', doc);
    }
  })
  .catch((e) => console.error('Something went wrong:\n', e.message))
  .finally(() => process.exit());
