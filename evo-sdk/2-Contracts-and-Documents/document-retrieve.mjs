/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/retrieve-documents.html
import setupEvoClient from '../setupEvoClient.mjs';

const sdk = setupEvoClient();
await sdk.connect();

const getDocuments = async () => {
  const contractId = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec';
  const documentType = 'domain';

  return sdk.documents.query({
    contractId,
    type: documentType,
    limit: 2, // Only retrieve 2 documents
  });
};

getDocuments()
  .then((d) => {
    for (const document of d) {
      console.log('Document:\n', document);
    }
  })
  .catch((e) => console.error('Something went wrong:\n', e.message));
