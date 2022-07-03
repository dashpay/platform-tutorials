// See https://dashplatform.readme.io/docs/tutorial-retrieve-documents
const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

const dapiOpts = {
  apps: {
    tutorialContract: {
      contractId: process.env.CONTRACT_ID, // Your contract ID
    },
  },
};
const dapi = new Dash.Client(dapiOpts);

const getDocuments = async () => {
  return dapi.platform.documents.get(
    'tutorialContract.note',
    {
      limit: 2, // Only retrieve 2 document
    },
  );
};

getDocuments()
  .then((d) => {
    for (const n of d) {
      console.log('Document:\n', n.toJSON());
    }
  })
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => dapi.disconnect());