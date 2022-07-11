// See https://dashplatform.readme.io/docs/tutorial-retrieve-a-name
const Dash = require('dash');

const client = new Dash.Client();

const nameToRetrieve = ''; // Enter name to retrieve

const retrieveName = async () => {
  // Retrieve by full name (e.g., myname.dash)
  return client.platform.names.resolve(`${nameToRetrieve}.dash`);
};

retrieveName()
  .then((d) => console.log('Name retrieved:\n', d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
