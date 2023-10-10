// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/retrieve-documents.html
const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

const clientOpts = {
  network: process.env.NETWORK,
  apps: {
    tutorialContract: {
      contractId: process.env.CONTRACT_ID, // Your contract ID
    },
  },
};
const client = new Dash.Client(clientOpts);

const getDocuments = async () => {
  return client.platform.documents.get('tutorialContract.note', {
    limit: 2, // Only retrieve 2 document
  });
};

getDocuments()
  .then((d) => {
    for (const n of d) {
      console.log('Document:\n', n.toJSON());
    }
  })
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
