"use strict";

// See https://dashplatform.readme.io/docs/tutorial-create-and-fund-a-wallet
const Dash = require("dash");

const DomStorage = require("dom-storage");
const myLocalStorage = new DomStorage("./db.json", { strict: true, ws: "  " });
const JsonStorage = require("json-storage").JsonStorage;
const store = JsonStorage.create(myLocalStorage, "dash", { stringify: true });
store.getItem = store.get;
store.setItem = store.set;

const clientOpts = {
  network: "testnet",
  wallet: {
    adapter: store,
    mnemonic: null, // this indicates that we want a new wallet to be generated
    // if you want to get a new address for an existing wallet
    // replace 'null' with an existing wallet mnemonic
    offlineMode: true, // this indicates we don't want to sync the chain
    // it can only be used when the mnemonic is set to 'null'
  },
};

const client = new Dash.Client(clientOpts);

const createWallet = async () => {
  const account = await client.getWalletAccount();

  const mnemonic = client.wallet.exportWallet();
  const address = account.getUnusedAddress();
  console.log("Mnemonic:", mnemonic);
  console.log("Unused address:", address.address);
};

createWallet()
  .catch((e) => console.error("Something went wrong:\n", e))
  .finally(() => client.disconnect());

// Handle wallet async errors
client.on("error", (error, context) => {
  console.error(`Client error: ${error.name}`);
  console.error(context);
});
