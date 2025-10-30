/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/register-a-data-contract.html
import setupEvoClient from '../setupEvoClient.mjs';

const sdk = setupEvoClient();
await sdk.connect();

const registerContract = async () => {
  const identityId = process.env.IDENTITY_ID; // Your identity ID
  const privateKeyWif = process.env.CRITICAL_KEY_WIF; // Identity's private key

  // Define the contract definition with all required fields
  const contractDefinition = {
    $format_version: "0",  // Required: Contract format version
    ownerId: identityId,   // Required: Owner's identity ID
    id: '11111111111111111111111111111111', // Placeholder
    version: 1,
    documentSchemas: {
      note: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            position: 0,
          },
        },
        required: ['message'],
        additionalProperties: false,
      },
    },
  };

  // Create and broadcast the data contract
  // The SDK handles both creation and publishing in one call
  const result = await sdk.contracts.create({
    ownerId: identityId,
    definition: contractDefinition,
    privateKeyWif,
  });

  return result;
};

registerContract()
  .then((d) => {
    console.log('Contract registered:\n', d);
  })
  .catch((e) => console.error('Something went wrong:\n', e.message))
  .finally(() => process.exit());
