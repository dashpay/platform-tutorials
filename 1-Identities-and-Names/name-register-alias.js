// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/register-a-name-for-an-identity.html
const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

const aliasToRegister = ''; // Enter alias to register

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

const registerAlias = async () => {
  const platform = client.platform;
  const identity = await platform.identities.get(process.env.IDENTITY_ID); // Your identity ID
  const aliasRegistration = await platform.names.register(
    `${aliasToRegister}.dash`,
    { dashAliasIdentityId: identity.getId() },
    identity,
  );

  return aliasRegistration;
};

registerAlias()
  .then((d) => console.log('Alias registered:\n', d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
