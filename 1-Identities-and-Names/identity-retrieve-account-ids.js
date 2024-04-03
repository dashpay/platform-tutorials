// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/retrieve-an-accounts-identities.html
const getClient = require('../getClient');

const client = getClient();

const retrieveIdentityIds = async () => {
  const account = await client.getWalletAccount();
  return account.identities.getIdentityIds();
};

retrieveIdentityIds()
  .then((d) => console.log('Mnemonic identities:\n', d))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
