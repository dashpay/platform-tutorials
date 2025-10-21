/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/retrieve-documents.html
import setupEvoClient from '../setupEvoClient.mjs';
import dotenv from 'dotenv';
dotenv.config();

const getDocuments = async () => {
  const sdk = setupEvoClient();
  await sdk.connect();

  // Use CONTRACT_ID from .env or hardcoded default
  const contractId = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec';
  const documentType = 'domain';

  const documents = await sdk.documents.query({
    contractId,
    type: documentType,
    limit: 2, // Only retrieve 2 documents
  });

  console.log(`Retrieved ${documents.length} documents:\n`);
  for (const doc of documents) {
    console.log('Document:', doc);
  }
  return documents;
};

getDocuments()
  .then((d) => console.log('\nSuccess!'))
  .catch((e) => console.error('Something went wrong:\n', e.message));
