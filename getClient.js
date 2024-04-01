const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

// Fully configured client options
const clientOptions = {
  // The network to connect to ('testnet' or 'mainnet')
  network: process.env.NETWORK,

  // Wallet configuration for transactions and account management
  wallet: {
    // The mnemonic (seed phrase) for the wallet. Required for signing transactions.
    mnemonic: process.env.MNEMONIC,

    // Unsafe wallet options (use with caution)
    unsafeOptions: {
      // Starting synchronization from a specific block height can speed up the initial wallet sync process.
      skipSynchronizationBeforeHeight: parseInt(
        process.env.SYNC_START_HEIGHT,
        10,
      ),
    },

    // The default account index to use for transactions and queries. Default is 0.
    // defaultAccountIndex: 0,
  },

  // Configuration for Dash Platform applications
  // apps: {
  //   dpns: { contractId: 'yourDpnsContractId' },
  //   yourApp: { contractId: 'yourCustomAppContractId' },
  // },

  // Custom list of DAPI seed nodes to connect to. Overrides the default seed list.
  // Format: { service: 'ip|domain:port' }
  // seeds: [
  //   { host: 'seed-1.testnet.networks.dash.org:1443' }
  // ],

  // Custom list of DAPI addresses to connect to
  // Format: [ 'ip:port' }
  // dapiAddresses: [ '127.0.0.1:3000' ],

  // Request timeout in milliseconds for DAPI calls
  // timeout: 3000,

  // The number of retries for a failed DAPI request before giving up
  // retries: 5,

  // The base ban time in milliseconds for a DAPI node that fails to respond properly
  // baseBanTime: 120000,
};

/**
 * Creates and returns a Dash client instance
 * @returns {Dash.Client} The Dash client instance.
 */
const getClient = () => {
  // Ensure that numeric values from environment variables are properly converted to numbers
  if (clientOptions.wallet?.unsafeOptions?.skipSynchronizationBeforeHeight) {
    clientOptions.wallet.unsafeOptions.skipSynchronizationBeforeHeight =
      parseInt(
        clientOptions.wallet.unsafeOptions.skipSynchronizationBeforeHeight,
        10,
      );
  }

  return new Dash.Client(clientOptions);
};

module.exports = getClient;
