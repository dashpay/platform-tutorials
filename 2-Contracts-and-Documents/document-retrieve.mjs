// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/retrieve-documents.html
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk } = await setupDashClient();

// Default tutorial contract (testnet). Replace or override via DATA_CONTRACT_ID.
const DATA_CONTRACT_ID =
  process.env.DATA_CONTRACT_ID ??
  'FW3DHrQiG24VqzPY4ARenMgjEPpBNuEQTZckV8hbVCG4';

try {
  const results = await sdk.documents.query({
    dataContractId: DATA_CONTRACT_ID,
    documentTypeName: 'note',
    limit: 2,
  });

  for (const [id, doc] of results) {
    console.log('Document:', id.toString(), doc.toJSON());
  }
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}