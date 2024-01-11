// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/update-documents.html
const Dash = require('dash');
const dotenv = require('dotenv');
dotenv.config();

const clientOpts = {
  network: process.env.NETWORK,
  wallet: {
    mnemonic: process.env.MNEMONIC, // A Dash wallet mnemonic with testnet funds
    unsafeOptions: {
      skipSynchronizationBeforeHeight: 875000, // only sync from mid-2023
    },
  },
};
const client = new Dash.Client(clientOpts);

const updateContract = async () => {
  const { platform } = client;
  const identity = await platform.identities.get(process.env.IDENTITY_ID); // Your identity ID

  const existingDataContract = await platform.contracts.get(
    process.env.CONTRACT_ID,
  );
  const documentSchema = existingDataContract.getDocumentSchema('note');

  documentSchema.properties.author = {
    type: 'string',
    position: 1,
  };

  existingDataContract.setDocumentSchema('note', documentSchema);

  // Sign and submit the data contract
  await platform.contracts.update(existingDataContract, identity);
  return existingDataContract;
};

updateContract()
  .then((d) => console.log('Contract updated:\n', d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
