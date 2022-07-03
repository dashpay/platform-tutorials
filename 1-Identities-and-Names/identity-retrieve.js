// See https://dashplatform.readme.io/docs/tutorial-retrieve-an-identity
const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

const dapi = new Dash.Client();

const retrieveIdentity = async () => {
  return dapi.platform.identities.get(process.env.IDENTITY_ID); // Your identity ID
};

retrieveIdentity()
  .then((d) => console.log('Identity retrieved:\n', d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => dapi.disconnect());
