// See https://dashplatform.readme.io/docs/tutorial-create-and-fund-a-wallet
const Dash = require('dash');

const dapiOpts = {
  network: 'testnet',
  wallet: {
    mnemonic: null, // this indicates that we want a new wallet to be generated
                    // if you want to get a new address for an existing wallet
                    // replace 'null' with an existing wallet mnemonic
    offlineMode: true,  // this indicates we don't want to sync the chain
                        // it can only be used when the mnemonic is set to 'null'
  },
};

const dapi = new Dash.Client(dapiOpts);

const createWallet = async () => {
  const account = await dapi.getWalletAccount();

  const mnemonic = dapi.wallet.exportWallet();
  const address = account.getUnusedAddress();
  console.log('Mnemonic:', mnemonic);
  console.log('Unused address:', address.address);
};

createWallet()
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => dapi.disconnect());

// Handle wallet async errors
dapi.on('error', (error, context) => {
  console.error(`Client error: ${error.name}`);
  console.error(context);
});