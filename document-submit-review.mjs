// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents/submit-documents.html
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config } from 'dotenv';
import { Document } from '@dashevo/evo-sdk';

// Load the repo-root .env explicitly so this script works no matter which
// directory `node` is invoked from. The root setupDashClient.mjs calls
// dotenv's config() at import time relative to process.cwd(), which misses
// the root .env when running from example-apps/dashrate/. Load it here,
// before that import runs, pointing at the repo root.
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

const { setupDashClient } = await import('./setupDashClient.mjs');

const { sdk, keyManager } = await setupDashClient();
const { identity, identityKey, signer } = await keyManager.getAuth();

const DATA_CONTRACT_ID = 'BdgTqaTAPYMyhp1WdeWdcvYSgoD7AuJ7tVCaCSXyQgyP';

try {
  // Create a new DashRate review document.
  const document = new Document({
    properties: {
      resourceId: 'identities-names',
      rating: 3,
      reviewText:
        'Identity registration is fine, but the key-management part glosses over which key index does what.',
    },
    documentTypeName: 'review',
    dataContractId: DATA_CONTRACT_ID,
    ownerId: identity.id,
  });

  // Submit the document to the platform
  await sdk.documents.create({
    document,
    identityKey,
    signer,
  });

  console.log('Document submitted:\n', document.toJSON());
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
