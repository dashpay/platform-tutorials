/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/retrieve-a-name.html
import setupEvoClient from '../setupEvoClient.mjs';

const nameToRetrieve = 'Tutorial-Test-000000'; // Enter name to retrieve identity for

const retrieveName = async () => {
  const sdk = setupEvoClient();
  await sdk.connect();

  // Resolve by full name (e.g., myname.dash)
  const nameInfo = await sdk.dpns.resolveName(`${nameToRetrieve}.dash`);
  console.log('Name resolved:', nameInfo);
  return nameInfo;
};

retrieveName()
  .then((d) => console.log('\nSuccess!'))
  .catch((e) => console.error('Failed:', e.message));
