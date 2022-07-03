// See https://dashplatform.readme.io/docs/tutorial-connecting-to-testnet
const Dash = require("dash");

const client = new Dash.Client();

async function connect() {
  return await client.getDAPIClient().core.getBestBlockHash();
}

connect()
  .then(function (d) {
    console.log("Connected. Best block hash:\n", d);
  })
  .catch(function (e) {
    console.error("Something went wrong:\n", e);
  })
  .then(function () {
    client.disconnect();
  });
