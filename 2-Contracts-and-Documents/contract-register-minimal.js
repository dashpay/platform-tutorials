// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/register-a-data-contract.html
const setupDashClient = require('../setupDashClient');

const client = setupDashClient();

const registerContract = async () => {
  const { platform } = client;
  const identity = await platform.identities.get(process.env.IDENTITY_ID); // Your identity ID

  const contractDocuments = {
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
