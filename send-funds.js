// See https://dashplatform.readme.io/docs/tutorial-send-funds
const Dash = require("dash");
const dotenv = require("dotenv");
dotenv.config();

const clientOpts = {
  network: "testnet",
  wallet: {
    mnemonic: process.env.MNEMONIC, // A Dash wallet mnemonic with testnet funds
    unsafeOptions: {
      skipSynchronizationBeforeHeight: 675000, // only sync from early-2022
    },
  },
};
const client = new Dash.Client(clientOpts);

const sendFunds = async () => {
  const account = await client.getWalletAccount();

  const transaction = account.createTransaction({
    recipient: "yP8A3cbdxRtLRduy5mXDsBnJtMzHWs6ZXr", // Testnet faucet
    satoshis: 10000000, // 0.1 Dash
  });
  return account.broadcastTransaction(transaction);
};

sendFunds()
  .then((d) => console.log("Transaction broadcast!\nTransaction ID:", d))
  .catch((e) => console.error("Something went wrong:\n", e))
  .finally(() => client.disconnect());

// Handle wallet async errors
client.on("error", (error, context) => {
  console.error(`Client error: ${error.name}`);
  console.error(context);
});
