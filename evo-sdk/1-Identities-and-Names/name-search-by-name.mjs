/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/retrieve-a-name.html
import setupEvoClient from '../setupEvoClient.mjs';

const searchPrefix = 'test'; // Enter prefix character(s) to search for

const retrieveNameBySearch = async () => {
  const sdk = setupEvoClient();
  await sdk.connect();

  // DPNS contract ID
  const dpnsContractId = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec';

  // Search for names using document query with startsWith filter
  const names = await sdk.documents.query({
    contractId: dpnsContractId,
    type: 'domain',
    where: JSON.stringify([
      ['normalizedParentDomainName', '==', 'dash'],
      ['normalizedLabel', 'startsWith', searchPrefix.toLowerCase()],
    ]),
    orderBy: JSON.stringify([['normalizedLabel', 'asc']]),
    limit: 2,
  });

  console.log(`Found ${names.length} names:\n`);
  for (const name of names) {
    console.log(name.data)
  }
  return names;
};

retrieveNameBySearch()
  .then((d) => console.log('\nSuccess!'))
  .catch((e) => console.error('Failed:', e.message));
