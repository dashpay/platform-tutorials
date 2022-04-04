// See https://dashplatform.readme.io/docs/tutorial-use-dapi-client-methods
const Dash = require('dash');

const client = new Dash.Client();

async function dapiClientMethods() {
  console.log(await client.getDAPIClient().core.getBlockHash(1));
  console.log(await client.getDAPIClient().core.getBestBlockHash());
  console.log(await client.getDAPIClient().core.getBlockByHeight(1));

  return client.getDAPIClient().core.getStatus();
}

dapiClientMethods()
  .then((d) => console.log('Core status:\n', d))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());