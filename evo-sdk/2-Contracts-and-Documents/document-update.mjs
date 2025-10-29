/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/update-documents.html
import setupEvoClient from '../setupEvoClient.mjs';

const sdk = setupEvoClient();
await sdk.connect();

const updateNoteDocument = async () => {
  const identityId = process.env.IDENTITY_ID; // Your identity ID
  const contractId = process.env.CONTRACT_ID; // Your contract ID
  const documentId = process.env.DOCUMENT_ID; // Document to update
  const privateKeyWif = process.env.CRITICAL_KEY_WIF; // Identity's private key

  // Retrieve the existing document
  const [document] = await sdk.documents.query({
    contractId,
    type: 'note',
    where: [['$id', '==', documentId]],
  });

  // Prepare updated data
  const updatedData = {
    message: `Updated document @ ${new Date().toUTCString()}`,
  };

  // Replace the document with updated data
  const result = await sdk.documents.replace({
    contractId,
    type: 'note',
    documentId,
    ownerId: identityId,
    data: updatedData,
    revision: document.revision,
    privateKeyWif,
  });

  return result;
};

updateNoteDocument()
  .then((d) => console.log(d))
  .catch((e) => console.error('Something went wrong:\n', e.message))
  .finally(() => process.exit());
