// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/retrieve-data-contract-history.html
const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

const client = new Dash.Client({ network: process.env.NETWORK });

const retrieveContractHistory = async () => {
  const contractId = process.env.CONTRACT_ID; // Your contract ID
  return await client.platform.contracts.history(contractId, 0, 10, 0);
};

retrieveContractHistory()
  .then((d) => {
    Object.entries(d).forEach(([key, value]) => {
      client.platform.dpp.dataContract
        .createFromObject(value)
        .then((contract) => console.dir(contract.toJSON(), { depth: 5 }));
    });
  })
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
