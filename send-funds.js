// See https://dashplatform.readme.io/docs/tutorial-send-funds
const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

const dapiOpts = {
  network: 'testnet',
  wallet: {
    mnemonic: process.env.MNEMONIC, // A Dash wallet mnemonic with testnet funds
    unsafeOptions: {
      skipSynchronizationBeforeHeight: 675000, // only sync from early-2022
    },
  },
};
const dapi = new Dash.Client(dapiOpts);

const sendFunds = async () => {
  const account = await dapi.getWalletAccount();

  const transaction = account.createTransaction({
    recipient: 'yP8A3cbdxRtLRduy5mXDsBnJtMzHWs6ZXr', // Testnet faucet
    satoshis: 10000000, // 0.1 Dash
  });
  return account.broadcastTransaction(transaction);
};

sendFunds()
  .then((d) => console.log('Transaction broadcast!\nTransaction ID:', d))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => dapi.disconnect());

// Handle wallet async errors
dapi.on('error', (error, context) => {
  console.error(`Client error: ${error.name}`);
  console.error(context);
});