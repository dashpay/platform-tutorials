/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/retrieve-an-identity.html
import setupEvoClient from '../setupEvoClient.mjs';
import dotenv from 'dotenv';
dotenv.config();

const retrieveIdentity = async () => {
  const sdk = setupEvoClient();
  await sdk.connect();

  // Use IDENTITY_ID from .env or a well-known testnet identity as fallback
  const identityId = process.env.IDENTITY_ID || '7XcruVSsGQVSgTcmPewaE4tXLutnW1F6PXxwMbo8GYQC';
  console.log(`Retrieving identity: ${identityId}\n`);

  const identity = await sdk.identities.fetch(identityId);
  console.log('Identity retrieved:\n', identity.toJSON());
  return identity;
};

retrieveIdentity()
  .then((d) => console.log('\nSuccess!'))
  .catch((e) => console.error('Something went wrong:\n', e.message));
