// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/submit-documents.html
import { Document } from '@dashevo/evo-sdk';
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, keyManager } = await setupDashClient();
const { identity, identityKey, signer } = await keyManager.getAuth();

// Default tutorial contract (testnet). Replace or override via DATA_CONTRACT_ID.
const DATA_CONTRACT_ID =
  process.env.DATA_CONTRACT_ID ||
  'FW3DHrQiG24VqzPY4ARenMgjEPpBNuEQTZckV8hbVCG4';

try {
  // Create a new document
  const document = new Document({
    properties: {
      message: `Tutorial Test @ ${new Date().toUTCString()}`,
    },
    documentTypeName: 'note',
    dataContractId: DATA_CONTRACT_ID,
    ownerId: identity.id,
  });

  // Submit the document to the platform
  await sdk.documents.create({
    document,
    identityKey,
    signer,
  });

  console.log('Document submitted:\n', document.toJSON());
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
