// See https://dashplatform.readme.io/docs/tutorial-use-dapi-client-methods

const setupDashClient = require('./setupDashClient');

const client = setupDashClient();

async function dapiClientMethods() {
  console.log(await client.getDAPIClient().core.getBlockHash(1));
  console.log(await client.getDAPIClient().core.getBestBlockHash())
  // console.log(await client.getDAPIClient().core.getBlockByHeight(1)); // Disabled in Platform v1.0
  console.log(await client.getDAPIClient().core.getBestBlockHeight());
  // await client.getDAPIClient().core.getMasternodeStatus(); // Disabled in Platform v1.0

  return client.getDAPIClient().core.getBlockchainStatus();
}

dapiClientMethods()
  .then((d) => console.log('Core status:\n', d))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
