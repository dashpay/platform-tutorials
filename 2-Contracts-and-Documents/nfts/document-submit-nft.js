// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/submit-documents.html
const setupDashClient = require('../../setupDashClient');

const client = setupDashClient();
client.wallet.unsafeOptions.skipSynchronizationBeforeHeight = 1008047;

function generateRandomString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

const submitNoteDocument = async () => {
  const { platform } = client;
  const identity = await platform.identities.get(process.env.NFT_OWNER_ID); // Your identity ID

  const docProperties = {
    name: generateRandomString(10),
    description: 'Card',
    attack: Math.floor(Math.random() * 100) + 1,
    defense: Math.floor(Math.random() * 100) + 1,
  };

  // Create the note document
  const nftCard = await platform.documents.create(
    'nftContract.card',
    identity,
    docProperties,
  );
  console.log(nftCard.getId().toString());

  const documentBatch = {
    create: [nftCard], // Document(s) to create
    replace: [], // Document(s) to update
    delete: [], // Document(s) to delete
  };
  // Sign and submit the document(s)
  await platform.documents.broadcast(documentBatch, identity);
  return nftCard;
};

submitNoteDocument()
  .then((d) => console.dir(d.getData()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
