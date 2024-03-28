// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/update-an-identity.html
const Dash = require('dash');
const {
  PlatformProtocol: { IdentityPublicKey, IdentityPublicKeyWithWitness },
} = Dash;
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

  const newPublicKey = new IdentityPublicKeyWithWitness(1);
  newPublicKey.setId(newKeyId);
  newPublicKey.setSecurityLevel(IdentityPublicKey.SECURITY_LEVELS.HIGH);
  newPublicKey.setData(identityPublicKey);

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
