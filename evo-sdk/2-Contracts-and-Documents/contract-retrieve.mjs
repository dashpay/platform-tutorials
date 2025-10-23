/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/retrieve-a-data-contract.html
import setupEvoClient from '../setupEvoClient.mjs';
import dotenv from 'dotenv';
dotenv.config();

const sdk = setupEvoClient();
await sdk.connect();

const retrieveContract = async () => {
  // Use CONTRACT_ID from .env or the hardcoded default
  const contractId =
    process.env.CONTRACT_ID || 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec';
  return sdk.contracts.fetch(contractId);
};

retrieveContract()
  .then((d) => console.log('Contract retrieved:', d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e.message));
