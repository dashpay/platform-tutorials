// See https://dashplatform.readme.io/docs/tutorial-register-a-name-for-an-identity
const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

const nameToRegister = ''; // Enter name to register

const clientOpts = {
  wallet: {
    mnemonic: process.env.MNEMONIC,  // A Dash wallet mnemonic with testnet funds
    unsafeOptions: {
      skipSynchronizationBeforeHeight: 675000, // only sync from early-2022
    },
  },
};
const client = new Dash.Client(clientOpts);

const registerName = async () => {
  const { platform } = client;

  const identity = await platform.identities.get(process.env.IDENTITY_ID); // Your identity ID
  const nameRegistration = await platform.names.register(
    `${nameToRegister}.dash`,
    { dashUniqueIdentityId: identity.getId() },
    identity,
  );

  return nameRegistration;
};

registerName()
  .then((d) => console.log('Name registered:\n', d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());