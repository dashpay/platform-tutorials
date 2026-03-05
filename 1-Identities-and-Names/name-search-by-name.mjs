// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/retrieve-a-name.html
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk } = await setupDashClient();

const DPNS_CONTRACT_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec';
const PREFIX = 'Tutorial-Test-00';

try {
  // Convert prefix to homograph-safe form for normalized search
  const normalizedPrefix = await sdk.dpns.convertToHomographSafe(PREFIX);

  // Search the DPNS contract for matching names
  const results = await sdk.documents.query({
    dataContractId: DPNS_CONTRACT_ID,
    documentTypeName: 'domain',
    where: [
      ['normalizedParentDomainName', '==', 'dash'],
      ['normalizedLabel', 'startsWith', normalizedPrefix],
    ],
    orderBy: [['normalizedLabel', 'asc']],
  });

  for (const [id, doc] of results) {
    console.log(doc.toJSON())
    const { label, parentDomainName } = doc.toJSON();
    console.log(`${label}.${parentDomainName} (ID: ${id.toString()})`);
  }
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}