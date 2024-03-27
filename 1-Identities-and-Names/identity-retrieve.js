// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/retrieve-an-identity.html
const getClient = require('../getClient');

const client = getClient('readOnly');

const retrieveIdentity = async () => {
  return client.platform.identities.get(process.env.IDENTITY_ID); // Your identity ID
};

retrieveIdentity()
  .then((d) => console.log('Identity retrieved:\n', d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
