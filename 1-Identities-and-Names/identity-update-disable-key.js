// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/update-an-identity.html
const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

const clientOpts = {
  network: process.env.NETWORK,
  wallet: {
    mnemonic: process.env.MNEMONIC, // A Dash wallet mnemonic with testnet funds
    unsafeOptions: {
      skipSynchronizationBeforeHeight: process.env.SYNC_START_HEIGHT, // sync starting at this Core block height
    },
  },
};
const client = new Dash.Client(clientOpts);

const updateIdentityDisableKey = async () => {
  const identityId = process.env.IDENTITY_ID;
  const keyId = 2; // One of the identity's public key IDs

  // Retrieve the identity to be updated and the public key to disable
  const existingIdentity = await client.platform.identities.get(identityId);
  // console.log(existingIdentity.toJSON())
  const publicKeyToDisable = existingIdentity.getPublicKeyById(keyId);
  // console.log(publicKeyToDisable)

  const updateDisable = {
    disable: [publicKeyToDisable],
  };

  await client.platform.identities.update(existingIdentity, updateDisable);
  return client.platform.identities.get(identityId);
};

updateIdentityDisableKey()
  .then((d) => console.log('Identity updated:\n', d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
