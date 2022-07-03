// See https://dashplatform.readme.io/docs/tutorial-retrieve-a-name
const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

const searchPrefix = 'a'; // Enter prefix character(s) to search for

const dapi = new Dash.Client();

const retrieveNameBySearch = async () => {
  // Search for names (e.g. `user*`)
  return dapi.platform.names.search(searchPrefix, 'dash');
};

retrieveNameBySearch()
  .then((d) => {
    for (const name of d) {
      console.log('Name retrieved:\n', name.toJSON());
    }
  })
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => dapi.disconnect());