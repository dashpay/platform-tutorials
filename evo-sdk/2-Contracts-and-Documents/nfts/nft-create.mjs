/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/submit-documents.html
import crypto from 'crypto';
import setupEvoClient from '../../setupEvoClient.mjs';

const sdk = setupEvoClient();
await sdk.connect();

function generateRandomString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

const createNFTCard = async () => {
  const identityId = process.env.IDENTITY_ID; // Your identity ID
  const contractId = process.env.NFT_CONTRACT_ID; // Your NFT contract ID
  const privateKeyWif = process.env.CRITICAL_KEY_WIF; // Identity's private key

  const docProperties = {
    name: generateRandomString(10),
    description: 'Card',
    attack: Math.floor(Math.random() * 100) + 1,
    defense: Math.floor(Math.random() * 100) + 1,
  };

  // Generate 32 bytes of entropy for document ID
  const entropyHex = crypto.randomBytes(32).toString('hex');

  // Create and submit the NFT card document
  const nftCard = await sdk.documents.create({
    contractId,
    type: 'card',
    ownerId: identityId,
    data: docProperties,
    entropyHex,
    privateKeyWif,
  });

  return nftCard;
};

createNFTCard()
  .then((d) => {
    console.log('NFT created:\n', d);
  })
  .catch((e) => console.error('Something went wrong:\n', e.message))
  .finally(() => process.exit());
