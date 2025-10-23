/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/retrieve-a-name.html
import setupEvoClient from '../setupEvoClient.mjs';

const sdk = setupEvoClient();
await sdk.connect();
const searchPrefix = 'test'; // Enter prefix character(s) to search for

const retrieveNameBySearch = async () => {
  // DPNS contract ID
  const dpnsContractId = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec';

  // Search for names using document query with startsWith filter
  return sdk.documents.query({
    contractId: dpnsContractId,
    type: 'domain',
    where: JSON.stringify([
      ['normalizedParentDomainName', '==', 'dash'],
      ['normalizedLabel', 'startsWith', searchPrefix.toLowerCase()],
    ]),
    orderBy: JSON.stringify([['normalizedLabel', 'asc']]),
    limit: 2,
  });
};

retrieveNameBySearch()
  .then((d) => {
    for (const name of d) {
      console.log('Name retrieved:\n', name.data);
    }
  })
  .catch((e) => console.error('Something went wrong:\n', e.message));
