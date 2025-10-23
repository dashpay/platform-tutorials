/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/retrieve-an-identity.html
import setupEvoClient from '../setupEvoClient.mjs';
import dotenv from 'dotenv';
dotenv.config();

const sdk = setupEvoClient();
await sdk.connect();

const retrieveIdentity = async () => {
  const identityId = process.env.IDENTITY_ID || '7XcruVSsGQVSgTcmPewaE4tXLutnW1F6PXxwMbo8GYQC';
  return sdk.identities.fetch(identityId);
};

retrieveIdentity()
  .then((d) => console.log('Identity retrieved:\n', d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e.message));
