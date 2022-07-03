// See https://dashplatform.readme.io/docs/tutorial-use-dapi-dapi-methods
const Dash = require('dash');

const dapi = new Dash.Client();

async function dapiClientMethods() {
  console.log(await dapi.getDAPIClient().core.getBlockHash(1));
  console.log(await dapi.getDAPIClient().core.getBestBlockHash());
  console.log(await dapi.getDAPIClient().core.getBlockByHeight(1));

  return dapi.getDAPIClient().core.getStatus();
}

dapiClientMethods()
  .then((d) => console.log('Core status:\n', d))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => dapi.disconnect());