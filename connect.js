// See https://dashplatform.readme.io/docs/tutorial-connecting-to-testnet

const setupDashClient = require('./setupDashClient');

const client = setupDashClient();

async function connect() {
  return await client.getDAPIClient().core.getBestBlockHash();
}

connect()
  .then((d) => console.log('Connected. Best block hash:\n', d))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
