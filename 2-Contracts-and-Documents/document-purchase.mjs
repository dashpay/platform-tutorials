import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, keyManager } = await setupDashClient();
const { identity, identityKey, signer } = await keyManager.getAuth();

// Purchase works with any document type whose contract enables `tradeMode`.
// Here the purchased document is the `domain` behind a DPNS name.
const DPNS_CONTRACT_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec';
const NAME_LABEL = process.env.NAME_LABEL || 'alice';

try {
  // Fetch immediately before purchase so the revision, owner, and price are
  // current. Platform rejects the purchase if the listing changes meanwhile.
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

  // Buying your own listing is rejected by the platform
  if (document.ownerId.toString() === identity.id.toString()) {
    throw new Error(`"${NAME_LABEL}.dash" is already owned by ${identity.id}`);
  }

  // Read the native bigint directly. toJSON() cannot safely represent every
  // possible unsigned 64-bit credit value.
  const price = document.properties?.['$price'];
  if (typeof price !== 'bigint' || price <= 0n) {
    throw new Error(`Name "${NAME_LABEL}.dash" is not currently for sale`);
  }

  document.revision = BigInt(document.revision ?? 0) + 1n;

  await sdk.documents.purchase({
    document,
    buyerId: identity.id,
    price,
    identityKey,
    signer,
  });

  console.log(
    `Document for "${NAME_LABEL}.dash" purchased for ${price} credits.`,
  );
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
