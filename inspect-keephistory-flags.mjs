// Read-only: fetch a contract on testnet and report keep-history / can-be-deleted flags.
import { EvoSDK } from '@dashevo/evo-sdk';

const CONTRACT_ID =
  process.argv[2] || '5CBPiadGmx3Zsjc26g5onopcx7pdxHPbrRAUD2T2yAbC';

const sdk = EvoSDK.testnetTrusted();
await sdk.connect();

try {
  const contract = await sdk.contracts.fetch(CONTRACT_ID);
  const json = contract.toJSON();

  console.log('Contract:', CONTRACT_ID);
  const docTypes = json.documentSchemas || json.documents || {};
  for (const [name, schema] of Object.entries(docTypes)) {
    const keepHistory =
      schema.documentsKeepHistory ?? schema.keepsHistory ?? schema.keepHistory;
    const canBeDeleted = schema.canBeDeleted;
    const mutable = schema.documentsMutable ?? schema.mutable;
    console.log(`\n  documentType: ${name}`);
    console.log(`    documentsKeepHistory: ${keepHistory}`);
    console.log(`    canBeDeleted:         ${canBeDeleted}`);
    console.log(`    documentsMutable:     ${mutable}`);
    if (keepHistory === true && canBeDeleted === true) {
      console.log('    >>> CONFLICT: keepHistory && canBeDeleted both true');
    }
  }

  console.log('\n--- raw document schemas ---');
  console.log(JSON.stringify(docTypes, null, 2));
} catch (e) {
  console.error('Fetch failed:\n', e.message);
} finally {
  process.exit(0);
}
