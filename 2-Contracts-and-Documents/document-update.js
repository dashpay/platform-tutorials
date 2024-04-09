// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/update-documents.html
const setupDashClient = require('../setupDashClient');

const client = setupDashClient();

const updateNoteDocument = async () => {
  const { platform } = client;
  const identity = await platform.identities.get(process.env.IDENTITY_ID); // Your identity ID
  const documentId = process.env.DOCUMENT_ID; // An existing document

  // Retrieve the existing document
  const [document] = await client.platform.documents.get(
    'tutorialContract.note',
    { where: [['$id', '==', documentId]] },
  );

  // Update document
  document.set('message', `Updated document @ ${new Date().toUTCString()}`);

  // Sign and submit the document replace transition
  await platform.documents.broadcast({ replace: [document] }, identity);
  return document;
};

updateNoteDocument()
  .then((d) => console.log('Document updated:\n', d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
