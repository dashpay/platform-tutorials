/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/submit-documents.html
import crypto from 'crypto';
import setupEvoClient from '../setupEvoClient.mjs';

const sdk = setupEvoClient();
await sdk.connect();

const submitNoteDocument = async () => {
  const identityId = process.env.IDENTITY_ID; // Your identity ID
  const contractId = process.env.CONTRACT_ID; // Your contract ID
  const privateKeyWif = process.env.CRITICAL_KEY_WIF; // Identity's private key

  const docProperties = {
    message: `Tutorial Test @ ${new Date().toUTCString()}`,
  };

  // Generate 32 bytes of entropy for document ID
  const entropyHex = crypto.randomBytes(32).toString('hex');

  // Create and submit the note document
  // The SDK handles document creation, signing, and broadcasting in one call
  const noteDocument = await sdk.documents.create({
    contractId,
    type: 'note',
    ownerId: identityId,
    data: docProperties,
    entropyHex,
    privateKeyWif,
  });

  return noteDocument;
};

submitNoteDocument()
  .then((d) => console.log(d))
  .catch((e) => console.error('Something went wrong:\n', e.message))
  .finally(() => process.exit());
