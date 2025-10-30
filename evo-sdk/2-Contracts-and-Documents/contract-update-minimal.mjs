/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/update-documents.html
import setupEvoClient from '../setupEvoClient.mjs';

const sdk = setupEvoClient();
await sdk.connect();

const updateContract = async () => {
  const identityId = process.env.IDENTITY_ID; // Your identity ID
  const contractId = process.env.CONTRACT_ID; // Your contract ID
  const privateKeyWif = process.env.CRITICAL_KEY_WIF; // Identity's private key

  // Fetch the existing contract
  const existingContract = await sdk.contracts.fetch(contractId);

  // Define the complete updated contract definition
  // This adds a new 'author' property to the existing 'note' document type
  const updates = {
    $format_version: '0',
    ownerId: identityId,
    id: contractId,
    version: existingContract.toJSON().version + 1, // Increment version
    documentSchemas: {
      note: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            position: 0,
          },
          author: {
            type: 'string',
            position: 1,
          },
        },
        required: ['message'],
        additionalProperties: false,
      },
    },
  };

  // Update the contract with the new schema
  const result = await sdk.contracts.update({
    contractId,
    ownerId: identityId,
    updates,
    privateKeyWif,
  });

  return result;
};

updateContract()
  .then((d) => console.log('Contract updated:\n', d))
  .catch((e) => console.error('Something went wrong:\n', e.message))
  .finally(() => process.exit());
