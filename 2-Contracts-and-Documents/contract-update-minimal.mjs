// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/update-a-data-contract.html
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, keyManager } = await setupDashClient();
const { identityKey, signer } = await keyManager.getAuth();

// Edit these values for your environment
// Your contract ID from the Register a Data Contract tutorial
const DATA_CONTRACT_ID =
  process.env.DATA_CONTRACT_ID ??
  'YOUR_DATA_CONTRACT_ID';
const DOCUMENT_TYPE = 'note';

if (!DATA_CONTRACT_ID || DATA_CONTRACT_ID === 'YOUR_DATA_CONTRACT_ID') {
  throw new Error('Set DATA_CONTRACT_ID (env var or in code) to your contract ID from the Register a Data Contract tutorial');
}

try {
  const existingContract = await sdk.contracts.fetch(DATA_CONTRACT_ID);

  // Increment the contract version
  existingContract.version += 1;

  // Clone schemas, then add a new "author" property to the DOCUMENT_TYPE schema
  const updatedSchemas = structuredClone(existingContract.schemas);
  updatedSchemas[DOCUMENT_TYPE].properties.author = {
    type: 'string',
    position: 1,
  };

  // Apply the updated schemas (enable full validation)
  existingContract.setSchemas(updatedSchemas, undefined, true, undefined);

  // Submit the update
  await sdk.contracts.update({
    dataContract: existingContract,
    identityKey,
    signer,
  });

  console.log('Contract updated:\n', existingContract.toJSON());
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
