/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/register-a-data-contract.html
import setupEvoClient from '../setupEvoClient.mjs';

const sdk = setupEvoClient();
await sdk.connect();

const registerContract = async () => {
  const identityId = process.env.IDENTITY_ID; // Your identity ID
  const privateKeyWif = process.env.CRITICAL_KEY_WIF; // Identity's private key

  // Define the NFT contract with trading card schema
  const contractDefinition = {
    $format_version: '0',
    ownerId: identityId,
    id: '11111111111111111111111111111111', // Placeholder
    version: 1,
    documentSchemas: {
      card: {
        type: 'object',
        documentsMutable: false, // NFTs cannot be modified after creation
        canBeDeleted: true,
        transferable: 1, // 0 = transfers disabled; 1 = transfers enabled
        tradeMode: 1, // 0 = no trading; 1 = direct purchases
        creationRestrictionMode: 1, // 0 = anyone can mint; 1 = only owner can mint
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
            properties: [
              {
                $ownerId: 'asc',
              },
            ],
          },
          {
            name: 'attack',
            properties: [
              {
                attack: 'asc',
              },
            ],
          },
          {
            name: 'defense',
            properties: [
              {
                defense: 'asc',
              },
            ],
          },
        ],
        required: ['name', 'attack', 'defense'],
        additionalProperties: false,
      },
    },
  };

  // Create and broadcast the NFT contract
  const result = await sdk.contracts.create({
    ownerId: identityId,
    definition: contractDefinition,
    privateKeyWif,
  });

  return result;
};

registerContract()
  .then((d) => {
    console.log('Contract registers:\n', d);
  })
  .catch((e) => console.error('Something went wrong:\n', e.message))
  .finally(() => process.exit());
