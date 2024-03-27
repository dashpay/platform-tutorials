// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/register-an-identity.html
const getClient = require('../getClient');

const client = getClient('readWrite');

const createIdentity = async () => {
  return client.platform.identities.register();
};

createIdentity()
  .then((d) => console.log('Identity:\n', d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
