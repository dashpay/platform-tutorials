import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, keyManager } = await setupDashClient();
const { identity, identityKey, signer } = await keyManager.getAuth();

// Pricing works with any document type whose contract enables `tradeMode`.
// This tutorial lists the `domain` document behind a DPNS name.
const DPNS_CONTRACT_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec';
const NAME_LABEL = process.env.NAME_LABEL || 'alice';

// Price in credits. A price of 0 removes the document from sale.
const PRICE = BigInt(process.env.DOCUMENT_PRICE || 100_000_000);

try {
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

  // Only the current owner can change a document's sale price
  if (document.ownerId.toString() !== identity.id.toString()) {
    throw new Error(
      `"${NAME_LABEL}.dash" is owned by ${document.ownerId}, not ${identity.id}`,
    );
  }

  document.revision = BigInt(document.revision ?? 0) + 1n;

  await sdk.documents.setPrice({
    document,
    price: PRICE,
    identityKey,
    signer,
  });

  console.log(
    PRICE === 0n
      ? `Document for "${NAME_LABEL}.dash" removed from sale.`
      : `Document for "${NAME_LABEL}.dash" listed for ${PRICE} credits.`,
  );
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
