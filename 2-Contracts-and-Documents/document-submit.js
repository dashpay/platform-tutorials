// See https://dashplatform.readme.io/docs/tutorial-submit-documents
const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

const dapiOpts = {
  network: 'testnet',
  wallet: {
    mnemonic: process.env.MNEMONIC, // A Dash wallet mnemonic with testnet funds
    unsafeOptions: {
      skipSynchronizationBeforeHeight: 675000, // only sync from early-2022
    },
  },
  apps: {
    tutorialContract: {
      contractId: process.env.CONTRACT_ID, // Your contract ID
    },
  },
};
const dapi = new Dash.Client(dapiOpts);

const submitNoteDocument = async () => {
  const { platform } = dapi;
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
    replace: [],            // Document(s) to update
    delete: [],             // Document(s) to delete
  };
  // Sign and submit the document(s)
  return platform.documents.broadcast(documentBatch, identity);
};

submitNoteDocument()
  .then((d) => console.log(d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => dapi.disconnect());