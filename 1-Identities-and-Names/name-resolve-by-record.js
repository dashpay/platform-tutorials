// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/retrieve-a-name.html
const setupDashClient = require('../setupDashClient');

const client = setupDashClient();

const retrieveNameByRecord = async () => {
  // Retrieve by a name's identity ID
  return client.platform.names.resolveByRecord(
    'dashUniqueIdentityId',
    process.env.IDENTITY_ID, // Your identity ID
  );
};

retrieveNameByRecord()
  .then((d) => console.log('Name retrieved:\n', d[0].getData()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
