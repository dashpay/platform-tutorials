// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/delete-documents.html
const getClient = require('../getClient');

const client = getClient();

const deleteNoteDocument = async () => {
  const { platform } = client;
  const identity = await platform.identities.get(process.env.IDENTITY_ID); // Your identity ID
  const documentId = process.env.DOCUMENT_ID; // An existing document

  // Retrieve the existing document
  const [document] = await client.platform.documents.get(
    'tutorialContract.note',
    { where: [['$id', '==', documentId]] },
  );

  // Sign and submit the document delete transition
  await platform.documents.broadcast({ delete: [document] }, identity);
  return document;
};

deleteNoteDocument()
  .then((d) => console.log('Document deleted:\n', d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
