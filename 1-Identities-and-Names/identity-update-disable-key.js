// See https://dashplatform.readme.io/docs/tutorial-update-an-identity
const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

const clientOpts = {
  network: 'testnet',
  wallet: {
    mnemonic: process.env.MNEMONIC, // A Dash wallet mnemonic with testnet funds
    unsafeOptions: {
      skipSynchronizationBeforeHeight: 675000, // only sync from early-2022
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
}

updateIdentityDisableKey()
  .then((d) => console.log('Identity updated:\n', d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());


