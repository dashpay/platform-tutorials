// See https://dashplatform.readme.io/docs/tutorial-retrieve-an-identity
const Dash = require("dash");
const dotenv = require("dotenv");
dotenv.config();

const client = new Dash.Client();

const retrieveIdentity = async () => {
  return client.platform.identities.get(process.env.IDENTITY_ID); // Your identity ID
};

retrieveIdentity()
  .then((d) => console.log("Identity retrieved:\n", d.toJSON()))
  .catch((e) => console.error("Something went wrong:\n", e))
  .finally(() => client.disconnect());
