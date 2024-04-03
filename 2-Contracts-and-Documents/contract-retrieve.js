// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/retrieve-a-data-contract.html
const setupDashClient = require('../setupDashClient');

const client = setupDashClient();

const retrieveContract = async () => {
  const contractId = process.env.CONTRACT_ID; // Your contract ID
  return client.platform.contracts.get(contractId);
};

retrieveContract()
  .then((d) => console.dir(d.toJSON(), { depth: 5 }))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
