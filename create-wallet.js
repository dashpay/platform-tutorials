"use strict";

require("dotenv").config({ path: ".env" });

// See https://dashplatform.readme.io/docs/tutorial-create-and-fund-a-wallet
const Dash = require("dash");

const Mnemonic = require("./lib/mnemonic.js");
const store = require("./lib/store.js").create({
  filepath: "./db.json",
  namespace: "dash",
});

async function main() {
  const clientOpts = {
    network: "testnet",
    wallet: {
      adapter: store,
      // `null` would indicates that we want a new wallet to be generated
      mnemonic: await Mnemonic.getOrCreate(process.env.MNEMONIC),
      offlineMode: true, // this indicates we don't want to sync the chain
      // it can only be used when the mnemonic is set to 'null'
    },
  };

  const client = new Dash.Client(clientOpts);
  // Handle wallet async errors
  client.on("error", (error, context) => {
    console.error(`Client error: ${error.name}`);
    console.error(context);
  });

  let err = await createWallet(client).catch(function (e) {
    return e;
  });
  client.disconnect();
  if (err) {
    throw err;
  }
}

async function createWallet(client) {
  const account = await client.getWalletAccount();

  const address = account.getUnusedAddress();
  console.log("Unused address:", address.address);
}

main().catch(function (err) {
  console.error("Something went wrong:");
  console.error(err.stack);
});
