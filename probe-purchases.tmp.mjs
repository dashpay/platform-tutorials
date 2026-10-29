import { createClient } from './setupDashClient-core.mjs';

const HISTORY_ID = '6voHRaoiPcfmMhbqCA9dixH98xcgPQ9UEcuaXjpVu3LD';
const DPNS_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec';
const sdk = await createClient('testnet');

// (1) The query I ran before, but paginated to exhaustion + both directions.
for (const dir of ['asc', 'desc']) {
  try {
    const r = await sdk.documents.query({
      dataContractId: HISTORY_ID,
      documentTypeName: 'purchase',
      where: [['dataContractId', '==', DPNS_ID]],
      orderBy: [['$createdAt', dir]],
      limit: 100,
    });
    console.log(`purchase byContract DPNS (${dir}): ${r.size ?? 0}`);
    for (const [id, d] of r) {
      const j = d.toJSON();
      console.log(
        `   ${id} doc=${j.documentId} price=${j.price} seller=${j.sellerId} buyer=${j.$ownerId} at=${j.$createdAt}`,
      );
    }
  } catch (e) {
    console.log(
      `purchase byContract (${dir}) FAILED: ${e.message.slice(0, 160)}`,
    );
  }
}

// (2) ALL purchases, no dataContractId filter — maybe DPNS purchases are
// recorded under a different dataContractId than I assumed.
try {
  const r = await sdk.documents.query({
    dataContractId: HISTORY_ID,
    documentTypeName: 'purchase',
    orderBy: [['$id', 'asc']],
    limit: 100,
  });
  console.log(`\nALL purchase records (any contract): ${r.size ?? 0}`);
  const byContract = new Map();
  for (const [, d] of r) {
    const j = d.toJSON();
    byContract.set(
      j.dataContractId,
      (byContract.get(j.dataContractId) ?? 0) + 1,
    );
  }
  for (const [c, n] of byContract) {
    console.log(
      `   dataContractId=${c} -> ${n}   ${c === DPNS_ID ? '<-- DPNS' : ''}`,
    );
  }
  for (const [id, d] of r) {
    const j = d.toJSON();
    if (j.dataContractId === DPNS_ID) {
      console.log(
        `   DPNS PURCHASE: ${id} doc=${j.documentId} price=${j.price} seller=${j.sellerId} buyer=${j.$ownerId} at=${j.$createdAt}`,
      );
    }
  }
} catch (e) {
  console.log(`\nALL purchase query FAILED: ${e.message.slice(0, 200)}`);
}

// (3) Provable count + average via the averageable index.
try {
  const c = await sdk.documents.count({
    dataContractId: HISTORY_ID,
    documentTypeName: 'purchase',
    where: [['dataContractId', '==', DPNS_ID]],
  });
  console.log(`\ncount(purchase, DPNS):`, [...(c?.entries?.() ?? [])]);
} catch (e) {
  console.log(`\ncount FAILED: ${e.message.slice(0, 200)}`);
}
