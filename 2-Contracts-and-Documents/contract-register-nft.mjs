// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/register-a-data-contract.html
import { DataContract } from '@dashevo/evo-sdk';
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, keyManager } = await setupDashClient();
const { identity, identityKey, signer } = await keyManager.getAuth();

// Define the document schemas for the contract
const documentSchemas = {
  card: {
    type: 'object',
    documentsMutable: false,    // true = documents can be modified (replaced)
    canBeDeleted: true,         // true = documents can be deleted
    transferable: 1,            // 0 = transfers disabled; 1 = transfers enabled
    tradeMode: 1,               // 0 = no trading; 1 = direct purchases
    creationRestrictionMode: 1, // 0 = anyone can mint; 1 = only contract owner can mint
    properties: {
      name: {
        type: 'string',
        description: 'Name of the card',
        minLength: 0,
        maxLength: 63,
        position: 0,
      },
      description: {
        type: 'string',
        description: 'Description of the card',
        minLength: 0,
        maxLength: 256,
        position: 1,
      },
      attack: {
        type: 'integer',
        description: 'Attack power of the card',
        position: 2,
      },
      defense: {
        type: 'integer',
        description: 'Defense level of the card',
        position: 3,
      },
    },
    indices: [
      {
        name: 'owner',
        properties: [{ $ownerId: 'asc' }],
      },
      {
        name: 'attack',
        properties: [{ attack: 'asc' }],
      },
      {
        name: 'defense',
        properties: [{ defense: 'asc' }],
      },
    ],
    required: ['name', 'attack', 'defense'],
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
