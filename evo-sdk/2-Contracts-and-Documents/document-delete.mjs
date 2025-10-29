/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/delete-documents.html
import setupEvoClient from '../setupEvoClient.mjs';

const sdk = setupEvoClient();
await sdk.connect();

const deleteNoteDocument = async () => {
  const identityId = process.env.IDENTITY_ID; // Your identity ID
  const contractId = process.env.CONTRACT_ID; // Your contract ID
  const documentId = process.env.DOCUMENT_ID; // Document to delete
  const privateKeyWif = process.env.CRITICAL_KEY_WIF; // Identity's private key

  // Delete the document
  const result = await sdk.documents.delete({
    contractId,
    type: 'note',
    documentId,
    ownerId: identityId,
    privateKeyWif,
  });

  return result;
};

deleteNoteDocument()
  .then((d) => console.log(d))
  .catch((e) => console.error('Something went wrong:\n', e.message))
  .finally(() => process.exit());
