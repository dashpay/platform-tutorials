/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/retrieve-a-name.html
import setupEvoClient from '../setupEvoClient.mjs';

const sdk = setupEvoClient();
await sdk.connect();

const nameToRetrieve = 'Tutorial-Test-000000'; // Enter name to retrieve identity for

const retrieveName = async () => {
  // Resolve by full name (e.g., myname.dash)
  return sdk.dpns.resolveName(`${nameToRetrieve}.dash`);
};

retrieveName()
  .then((d) => console.log(`Identity for ${nameToRetrieve}:\n${d}`))
  .catch((e) => console.error('Something went wrong:\n', e.message));
