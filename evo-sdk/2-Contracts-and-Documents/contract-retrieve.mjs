/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/retrieve-a-data-contract.html
import setupEvoClient from '../setupEvoClient.mjs';
import dotenv from 'dotenv';
dotenv.config();

const retrieveContract = async () => {
  const sdk = setupEvoClient();
  await sdk.connect();

  // Use CONTRACT_ID from .env or the hardcoded default
  const contractId = process.env.CONTRACT_ID || 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec';
  console.log(`Retrieving contract: ${contractId}\n`);

  const contract = await sdk.contracts.fetch(contractId);
  console.log('Contract retrieved:', contract.toJSON());
  return contract;
};

retrieveContract()
  .then((d) => console.log('\nSuccess!'))
  .catch((e) => console.error('Something went wrong:\n', e.message));
