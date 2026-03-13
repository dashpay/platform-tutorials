// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/delete-documents.html
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, keyManager } = await setupDashClient();
const { identity, identityKey, signer } = await keyManager.getAuth();

// Default tutorial contract (testnet). Replace or override via DATA_CONTRACT_ID.
const DATA_CONTRACT_ID =
  process.env.DATA_CONTRACT_ID ??
  'FW3DHrQiG24VqzPY4ARenMgjEPpBNuEQTZckV8hbVCG4';

// Replace with your existing document ID
const DOCUMENT_ID = process.env.DOCUMENT_ID ?? 'YOUR_DOCUMENT_ID';

try {
  // Delete the document from the platform
  await sdk.documents.delete({
    document: {
      id: DOCUMENT_ID,
      ownerId: identity.id,
      dataContractId: DATA_CONTRACT_ID,
      documentTypeName: 'note',
    },
    identityKey,
    signer,
  });

  console.log('Document deleted successfully');
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
