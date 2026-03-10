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
  // Workaround: sdk.contracts.fetch() returns undefined for contracts with
  // keepsHistory: true due to a proof verification bug (dashpay/platform#3165).
  // Use getHistory() and take the latest version instead.
  // Note: for contracts with many revisions, history results may be paginated
  // and the last entry here may not be the true latest version.
  const history = await sdk.contracts.getHistory({
    dataContractId: DATA_CONTRACT_ID,
  });

  let existingContract;
  for (const [, contract] of history) {
    existingContract = contract;
  }

  if (!existingContract) {
    throw new Error(`Contract ${DATA_CONTRACT_ID} not found`);
  }

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

  // Enable storing of contract history
  existingContract.setConfig({
    canBeDeleted: false,
    readonly: false,
    keepsHistory: true,
    documentsKeepHistoryContractDefault: false,
    documentsMutableContractDefault: true,
  });

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
