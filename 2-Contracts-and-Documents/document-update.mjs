import { Document } from '@dashevo/evo-sdk';
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, keyManager } = await setupDashClient();
const { identity, identityKey, signer } = await keyManager.getAuth();

// Default tutorial contract (testnet). Replace or override via DATA_CONTRACT_ID.
const DATA_CONTRACT_ID =
  process.env.DATA_CONTRACT_ID ||
  'FW3DHrQiG24VqzPY4ARenMgjEPpBNuEQTZckV8hbVCG4';

// Replace with your existing document ID from the Submit Documents tutorial
const DOCUMENT_ID = process.env.DOCUMENT_ID || 'YOUR_DOCUMENT_ID';

try {
  // Fetch the existing document to get current revision
  const docs = await sdk.documents.query({
    dataContractId: DATA_CONTRACT_ID,
    documentTypeName: 'note',
    where: [['$id', '==', DOCUMENT_ID]],
  });
  const existingDoc = [...docs.values()][0];
  if (!existingDoc) {
    throw new Error(`Document ${DOCUMENT_ID} not found`);
  }

  // Create the replacement document with incremented revision
  const document = new Document({
    properties: {
      message: `Updated Tutorial Test @ ${new Date().toUTCString()}`,
    },
    documentTypeName: 'note',
    dataContractId: DATA_CONTRACT_ID,
    ownerId: identity.id,
    revision: existingDoc.revision + 1n,
    id: DOCUMENT_ID,
  });

  // Submit the replacement to the platform
  await sdk.documents.replace({
    document,
    identityKey,
    signer,
  });

  console.log('Document updated:\n', document.toJSON());
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
