import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, keyManager } = await setupDashClient();
const { identity, identityKey, signer } = await keyManager.getAuth();

// Transfer works with any document type whose contract enables `transferable`.
// This tutorial uses a DPNS name because names are familiar transferable documents.
const DPNS_CONTRACT_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec';
const NAME_LABEL = process.env.NAME_LABEL || 'alice';
const DOCUMENT_RECIPIENT_ID =
  process.env.DOCUMENT_RECIPIENT_ID || 'YOUR_DOCUMENT_RECIPIENT_ID';

try {
  // Check configuration before spending a network round-trip on the query
  if (DOCUMENT_RECIPIENT_ID === 'YOUR_DOCUMENT_RECIPIENT_ID') {
    throw new Error('Set DOCUMENT_RECIPIENT_ID to the new owner identity ID');
  }

  const documents = await sdk.documents.query({
    dataContractId: DPNS_CONTRACT_ID,
    documentTypeName: 'domain',
    where: [
      ['normalizedParentDomainName', '==', 'dash'],
      ['normalizedLabel', '==', NAME_LABEL.toLowerCase()],
    ],
  });
  const document = [...documents.values()][0];

  if (!document) {
    throw new Error(`Name "${NAME_LABEL}.dash" was not found`);
  }

  // Only the current owner can transfer a document
  if (document.ownerId.toString() !== identity.id.toString()) {
    throw new Error(
      `"${NAME_LABEL}.dash" is owned by ${document.ownerId}, not ${identity.id}`,
    );
  }

  document.revision = BigInt(document.revision ?? 0) + 1n;

  // A successful transfer also clears any active sale price
  await sdk.documents.transfer({
    document,
    recipientId: DOCUMENT_RECIPIENT_ID,
    identityKey,
    signer,
  });

  console.log(
    `Document for "${NAME_LABEL}.dash" transferred to ${DOCUMENT_RECIPIENT_ID}.`,
  );
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
