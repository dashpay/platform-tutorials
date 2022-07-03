// See https://dashplatform.readme.io/docs/tutorial-register-an-identity
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

const createIdentity = async () => {
  return dapi.platform.identities.register();
};

createIdentity()
  .then((d) => console.log('Identity:\n', d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => dapi.disconnect());