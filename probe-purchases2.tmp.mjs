import { createClient } from './setupDashClient-core.mjs';

const HISTORY_ID = '6voHRaoiPcfmMhbqCA9dixH98xcgPQ9UEcuaXjpVu3LD';
const DPNS_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec';
const sdk = await createClient('testnet');

// Ground truth from DPNS itself: a purchased name has $ownerId != $creatorId.
// Scan a wide slice of domains and look for owner/creator divergence, which
// indicates the doc changed hands (by transfer OR purchase).
let scanned = 0;
let moved = [];
let startAfter;
for (let page = 0; page < 12; page++) {
  const r = await sdk.documents.query({
    dataContractId: DPNS_ID,
    documentTypeName: 'domain',
    where: [['normalizedParentDomainName', '==', 'dash']],
    orderBy: [['normalizedLabel', 'asc']],
    limit: 100,
    ...(startAfter ? { startAfter } : {}),
  });
  const entries = [...r];
  if (entries.length === 0) break;
  for (const [id, d] of entries) {
    scanned++;
    const j = d.toJSON();
    if (j.$creatorId && j.$ownerId && j.$creatorId !== j.$ownerId) {
      moved.push({
        id,
        label: j.label,
        creator: j.$creatorId,
        owner: j.$ownerId,
        rev: j.$revision,
        transferredAt: j.$transferredAt,
        price: j.$price,
      });
    }
  }
  startAfter = entries[entries.length - 1][0];
  if (entries.length < 100) break;
}
console.log(`Scanned ${scanned} .dash domains`);
console.log(`Changed hands (creator != owner): ${moved.length}\n`);
for (const m of moved) {
  console.log(
    `  ${m.label}.dash  rev=${m.rev} transferredAt=${m.transferredAt}`,
  );
  console.log(`    creator=${m.creator}`);
  console.log(`    owner  =${m.owner}  $price=${m.price ?? 'ABSENT'}`);
  // For each, ask the history contract what it knows about this doc.
  for (const type of ['purchase', 'transfer', 'priceUpdate']) {
    try {
      const h = await sdk.documents.query({
        dataContractId: HISTORY_ID,
        documentTypeName: type,
        where: [
          ['dataContractId', '==', DPNS_ID],
          ['documentId', '==', m.id],
        ],
        orderBy: [['$createdAt', 'asc']],
        limit: 20,
      });
      if ((h.size ?? 0) > 0) {
        console.log(`    ${type}: ${h.size}`);
        for (const [, hd] of h) {
          const hj = hd.toJSON();
          console.log(
            `       price=${hj.price ?? '-'} seller=${hj.sellerId ?? '-'} to=${hj.toIdentityId ?? '-'} owner=${hj.$ownerId} at=${hj.$createdAt}`,
          );
        }
      }
    } catch (e) {
      console.log(`    ${type} query failed: ${e.message.slice(0, 90)}`);
    }
  }
  console.log();
}
