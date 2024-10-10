// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/register-a-data-contract.html
const setupDashClient = require('../setupDashClient');

const client = setupDashClient();

const registerContract = async () => {
  const { platform } = client;
  const identity = await platform.identities.get(process.env.IDENTITY_ID); // Your identity ID

  const contractDocuments = {
    card: {
      type: 'object',
      documentsMutable: false, // true = documents can be modified (replaced)
      canBeDeleted: true, // true = documents can be deleted (current bug prevents deletion when true if mutable is false)
      transferable: 1, // 0 = transfers disabled; 1 = transfers enabled
      tradeMode: 1, // 0 = no trading; 1 = direct purchases
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
  };

  const contract = await platform.contracts.create(contractDocuments, identity);
  console.dir({ contract: contract.toJSON() });

  // Sign and submit the data contract
  await platform.contracts.publish(contract, identity);
  return contract;
};

registerContract()
  .then((d) => console.log('Contract registered:\n', d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
