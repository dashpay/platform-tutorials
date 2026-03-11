// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/register-a-data-contract.html
import { DataContract } from '@dashevo/evo-sdk';
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, keyManager } = await setupDashClient();
const { identity, identityKey, signer } = await keyManager.getAuth();

// Define the document schemas for the contract
const documentSchemas = {
  note: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        position: 0,
      },
    },
    additionalProperties: false,
  },
};

try {
  // Get the next identity nonce for contract creation
  const identityNonce = await sdk.identities.nonce(identity.id.toString());

  // Create the data contract
  const dataContract = new DataContract({
    ownerId: identity.id,
    identityNonce: (identityNonce || 0n) + 1n,
    schemas: documentSchemas,
    fullValidation: true,
  });

  // Publish the contract to the platform
  const publishedContract = await sdk.contracts.publish({
    dataContract,
    identityKey,
    signer,
  });

  console.log('Contract registered:\n', publishedContract.toJSON());
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
