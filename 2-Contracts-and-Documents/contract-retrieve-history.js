const Dash = require('dash');
const {
  default: loadDpp,
  DashPlatformProtocol,
} = require('@dashevo/wasm-dpp');;
const dotenv = require('dotenv');
dotenv.config();

const client = new Dash.Client({ network: process.env.NETWORK });
loadDpp();
const dpp = new DashPlatformProtocol(null);

const retrieveContractHistory = async () => {
  const contractId = process.env.CONTRACT_ID; // Your contract ID
  return await client.platform.contracts.history(
    contractId, 0, 10, 0);
};

retrieveContractHistory()
  .then((d) => {
    Object.entries(d).forEach(([key, value]) => {
      dpp.dataContract.createFromObject(value).then((contract) => console.dir(contract.toJSON(), {depth: 5}))
    });
  })
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
