// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/retrieve-documents.html
const setupDashClient = require('../setupDashClient');

const client = setupDashClient();

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
