// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/retrieve-a-name.html
const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

const searchPrefix = 'a'; // Enter prefix character(s) to search for

const client = new Dash.Client({ network: process.env.NETWORK });

const retrieveNameBySearch = async () => {
  // Search for names (e.g. `user*`)
  return client.platform.names.search(searchPrefix, 'dash');
};

retrieveNameBySearch()
  .then((d) => {
    for (const name of d) {
      console.log('Name retrieved:\n', name.getData());
    }
  })
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
