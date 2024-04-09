// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/retrieve-an-identity.html
const setupDashClient = require('../setupDashClient');

const client = setupDashClient();

const retrieveIdentity = async () => {
  return client.platform.identities.get(process.env.IDENTITY_ID); // Your identity ID
};

retrieveIdentity()
  .then((d) => console.log('Identity retrieved:\n', d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
