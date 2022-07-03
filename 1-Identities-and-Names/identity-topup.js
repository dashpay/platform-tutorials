// See https://dashplatform.readme.io/docs/tutorial-topup-an-identity-balance
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

const topupIdentity = async () => {
  const identityId = process.env.IDENTITY_ID; // Your identity ID
  const topUpAmount = 1000; // Number of duffs

  await dapi.platform.identities.topUp(identityId, topUpAmount);
  return dapi.platform.identities.get(identityId);
};

topupIdentity()
  .then((d) => console.log('Identity credit balance: ', d.balance))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => dapi.disconnect());