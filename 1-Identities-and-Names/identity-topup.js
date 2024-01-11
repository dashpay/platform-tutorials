// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/topup-an-identity-balance.html
const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

const clientOpts = {
  network: process.env.NETWORK,
  wallet: {
    mnemonic: process.env.MNEMONIC, // A Dash wallet mnemonic with testnet funds
    unsafeOptions: {
      skipSynchronizationBeforeHeight: 875000, // only sync from mid-2023
    },
  },
};
const client = new Dash.Client(clientOpts);

const topupIdentity = async () => {
  const identityId = process.env.IDENTITY_ID; // Your identity ID
  const topUpAmount = 1000; // Number of duffs

  await client.platform.identities.topUp(identityId, topUpAmount);
  return client.platform.identities.get(identityId);
};

topupIdentity()
  .then((d) => console.log('Identity credit balance: ', d.balance))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
