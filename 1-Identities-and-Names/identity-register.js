// See https://dashplatform.readme.io/docs/tutorial-register-an-identity
const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

const clientOpts = {
  network: process.env.NETWORK,
  wallet: {
    mnemonic: process.env.MNEMONIC, // A Dash wallet mnemonic with testnet funds
    unsafeOptions: {
      skipSynchronizationBeforeHeight: 675000, // only sync from early-2022
    },
  },
};
const client = new Dash.Client(clientOpts);

const createIdentity = async () => {
  return client.platform.identities.register();
};

createIdentity()
  .then((d) => console.log('Identity:\n', d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
