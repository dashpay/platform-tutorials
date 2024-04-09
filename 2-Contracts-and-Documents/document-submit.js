// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/submit-documents.html
const setupDashClient = require('../setupDashClient');

const client = setupDashClient();

const submitNoteDocument = async () => {
  const { platform } = client;
  const identity = await platform.identities.get(process.env.IDENTITY_ID); // Your identity ID

  const docProperties = {
    message: `Tutorial Test @ ${new Date().toUTCString()}`,
  };

  // Create the note document
  const noteDocument = await platform.documents.create(
    'tutorialContract.note',
    identity,
    docProperties,
  );

  const documentBatch = {
    create: [noteDocument], // Document(s) to create
    replace: [], // Document(s) to update
    delete: [], // Document(s) to delete
  };
  // Sign and submit the document(s)
  await platform.documents.broadcast(documentBatch, identity);
  return noteDocument;
};

submitNoteDocument()
  .then((d) => console.log(d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
