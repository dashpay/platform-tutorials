// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/delete-documents.html
const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

const clientOpts = {
  network: process.env.NETWORK,
  wallet: {
    mnemonic: process.env.MNEMONIC, // A Dash wallet mnemonic with testnet funds
    unsafeOptions: {
      skipSynchronizationBeforeHeight: process.env.SYNC_START_HEIGHT, // sync starting at this Core block height
    },
  },
  apps: {
    tutorialContract: {
      contractId: process.env.CONTRACT_ID, // Your contract ID
    },
  },
};
const client = new Dash.Client(clientOpts);

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
