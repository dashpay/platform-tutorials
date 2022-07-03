// See https://dashplatform.readme.io/docs/tutorial-update-documents
const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

const dapiOpts = {
  wallet: {
    mnemonic: process.env.MNEMONIC, // A Dash wallet mnemonic with testnet funds
    unsafeOptions: {
      skipSynchronizationBeforeHeight: 650000, // only sync from early-2022
    },
  },
  apps: {
    tutorialContract: {
      contractId: process.env.CONTRACT_ID, // Your contract ID
    },
  },
};
const dapi = new Dash.Client(dapiOpts);

const updateNoteDocument = async () => {
  const { platform } = dapi;
  const identity = await platform.identities.get(process.env.IDENTITY_ID); // Your identity ID
  const documentId = process.env.DOCUMENT_ID; // An existing document

  // Retrieve the existing document
  const [document] = await dapi.platform.documents.get(
    'tutorialContract.note',
    { where: [['$id', '==', documentId]] },
  );

  // Update document
  document.set('message', `Updated document @ ${new Date().toUTCString()}`);

  // Sign and submit the document replace transition
  return platform.documents.broadcast({ replace: [document] }, identity);
};

updateNoteDocument()
  .then((d) => console.log('Document updated:\n', d))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => dapi.disconnect());