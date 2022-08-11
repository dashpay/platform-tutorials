// See https://dashplatform.readme.io/docs/tutorial-update-an-identity
const Dash = require('dash');
const IdentityPublicKey = require('@dashevo/dpp/lib/identity/IdentityPublicKey');
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

const updateIdentityAddKey = async () => {
  const identityId = process.env.IDENTITY_ID;
  const existingIdentity = await client.platform.identities.get(identityId);
  const newKeyId = existingIdentity.toJSON().publicKeys.length;

  // Get an unused identity index
  const account = await client.platform.client.getWalletAccount();
  const identityIndex = await account.getUnusedIdentityIndex();

  // Get unused private key and construct new identity public key
  const { privateKey: identityPrivateKey } =
    account.identities.getIdentityHDKeyByIndex(identityIndex, 0);

  const identityPublicKey = identityPrivateKey.toPublicKey().toBuffer();

  const newPublicKey = new IdentityPublicKey({
    id: newKeyId,
    type: IdentityPublicKey.TYPES.ECDSA_SECP256K1,
    purpose: IdentityPublicKey.PURPOSES.AUTHENTICATION,
    securityLevel: IdentityPublicKey.SECURITY_LEVELS.HIGH,
    data: identityPublicKey,
    readOnly: false,
  });

  const updateAdd = {
    add: [newPublicKey],
  };

  // Submit the update signed with the new key
  await client.platform.identities.update(existingIdentity, updateAdd, {
    [newPublicKey.getId()]: identityPrivateKey,
  });

  return client.platform.identities.get(identityId);
};

updateIdentityAddKey()
  .then((d) => console.log('Identity updated:\n', d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
