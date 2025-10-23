/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/retrieve-a-name.html
import setupEvoClient from '../setupEvoClient.mjs';
import dotenv from 'dotenv';
dotenv.config();

const sdk = setupEvoClient();
await sdk.connect();

const retrieveNameByRecord = async () => {
  // Retrieve DPNS names by identity ID (reverse lookup)
  const identityId = process.env.IDENTITY_ID || 'your-identity-id-here';
  return sdk.dpns.usernames(identityId);
};

retrieveNameByRecord()
  .then((d) => console.log('Name retrieved:\n', d[0])) //getId().toString()))
  .catch((e) => console.error('Something went wrong:\n', e.message));
