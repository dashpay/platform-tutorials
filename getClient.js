const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

// Define client options for different types
const clientOptions = {
  readWrite: {
    network: process.env.NETWORK,
    wallet: {
      mnemonic: process.env.MNEMONIC,
      unsafeOptions: {
        skipSynchronizationBeforeHeight: process.env.SYNC_START_HEIGHT, // sync starting at this Core block height
      },    
    },
  },
  readOnly: {
    network: process.env.NETWORK,
    // No wallet options required for the read-only client
  },
};

/**
 * Creates and returns a Dash client instance based on the specified type.
 * @param {String} type The type of client to create ('readWrite' or 'readOnly').
 * @returns {Dash.Client} The Dash client instance.
 */
const getClient = (type = 'readWrite') => {
  if (!clientOptions[type]) {
    throw new Error(`Unsupported client type: ${type}`);
  }
  return new Dash.Client(clientOptions[type]);
};

module.exports = getClient;
