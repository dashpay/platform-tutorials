// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/topup-an-identity-balance.html
const getClient = require('../getClient');

const client = getClient();

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
