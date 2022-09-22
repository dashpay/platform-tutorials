// See https://dashplatform.readme.io/docs/tutorial-connecting-to-testnet
const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

const client = new Dash.Client({ network: process.env.NETWORK });

async function connect() {
  return await client.getDAPIClient().core.getBestBlockHash();
}

connect()
  .then((d) => console.log('Connected. Best block hash:\n', d))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
