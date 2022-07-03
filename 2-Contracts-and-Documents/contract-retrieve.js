// See https://dashplatform.readme.io/docs/tutorial-retrieve-a-data-contract
const Dash = require("dash");
const dotenv = require("dotenv");
dotenv.config();

const client = new Dash.Client();

const retrieveContract = async () => {
  const contractId = process.env.CONTRACT_ID; // Your contract ID
  return client.platform.contracts.get(contractId);
};

retrieveContract()
  .then((d) => console.dir(d.toJSON(), { depth: 5 }))
  .catch((e) => console.error("Something went wrong:\n", e))
  .finally(() => client.disconnect());
