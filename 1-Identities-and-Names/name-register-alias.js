// See https://dashplatform.readme.io/docs/tutorial-register-a-name-for-an-identity
const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

const aliasToRegister = ''; // Enter alias to register

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
