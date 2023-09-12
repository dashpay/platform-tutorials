// See https://dashplatform.readme.io/docs/tutorial-retrieve-a-name
const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

const client = new Dash.Client({ network: process.env.NETWORK });

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
