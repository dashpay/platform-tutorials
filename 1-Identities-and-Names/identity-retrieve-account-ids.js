// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/retrieve-an-accounts-identities.html
const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

const client = new Dash.Client({
  network: process.env.NETWORK,
  wallet: {
    mnemonic: process.env.MNEMONIC, // A Dash wallet mnemonic with testnet funds
    unsafeOptions: {
      skipSynchronizationBeforeHeight: process.env.SYNC_START_HEIGHT, // sync starting at this Core block height
    },
  },
});

const retrieveIdentityIds = async () => {
  const account = await client.getWalletAccount();
  return account.identities.getIdentityIds();
};

retrieveIdentityIds()
  .then((d) => console.log('Mnemonic identities:\n', d))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
