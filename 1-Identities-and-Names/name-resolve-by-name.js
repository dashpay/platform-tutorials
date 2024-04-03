// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/retrieve-a-name.html
const getClient = require('../getClient');

const client = getClient();

const nameToRetrieve = ''; // Enter name to retrieve

const retrieveName = async () => {
  // Retrieve by full name (e.g., myname.dash)
  return client.platform.names.resolve(`${nameToRetrieve}.dash`);
};

retrieveName()
  .then((d) => console.log('Name retrieved:\n', d.getData()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
