import { createClient } from './setupDashClient-core.mjs';

const HISTORY_ID = '6voHRaoiPcfmMhbqCA9dixH98xcgPQ9UEcuaXjpVu3LD';
const DPNS_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec';
const sdk = await createClient('testnet');

// The transfer record found earlier proves ownership changes ARE recorded.
const KNOWN_TRANSFER_DOC = 'J8Gr44JEpczwBeKYGmmFaGnXAzXdGdu1N4F7rK8C3m16';
const KNOWN_PRICED_DOC = '2ccY4dgkYvsoqiquGn5715fXRBHopkXwYiXp2NNxisMc';

console.log('=== Per-document history for known docs ===');
for (const doc of [KNOWN_TRANSFER_DOC, KNOWN_PRICED_DOC]) {
  console.log(`\ndoc ${doc}`);
  try {
    const d = await sdk.documents.get(DPNS_ID, 'domain', doc);
    const j = d.toJSON();
    console.log(
      `  ${j.label}.dash creator=${j.$creatorId} owner=${j.$ownerId} rev=${j.$revision}`,
    );
    console.log(`  creator==owner? ${j.$creatorId === j.$ownerId}`);
  } catch (e) {
    console.log(`  get failed: ${e.message.slice(0, 100)}`);
  }
  for (const type of ['purchase', 'transfer', 'priceUpdate']) {
    try {
      const h = await sdk.documents.query({
        dataContractId: HISTORY_ID,
        documentTypeName: type,
        where: [
          ['dataContractId', '==', DPNS_ID],
          ['documentId', '==', doc],
        ],
        orderBy: [['$createdAt', 'asc']],
        limit: 20,
      });
      console.log(`  ${type}: ${h.size ?? 0}`);
      for (const [, hd] of h) {
        const hj = hd.toJSON();
        console.log(
          `     price=${hj.price ?? '-'} seller=${hj.sellerId ?? '-'} to=${hj.toIdentityId ?? '-'} owner=${hj.$ownerId}`,
        );
      }
    } catch (e) {
      console.log(`  ${type} failed: ${e.message.slice(0, 90)}`);
    }
  }
}

// Enumerate ALL history records of each type, unfiltered, to see the true
// contents of the history contract regardless of dataContractId.
console.log(
  '\n=== Full history contract contents (all types, any contract) ===',
);
for (const type of ['purchase', 'transfer', 'priceUpdate']) {
  let total = 0;
  const contracts = new Map();
  let startAfter;
  for (let page = 0; page < 20; page++) {
    let r;
    try {
      r = await sdk.documents.query({
        dataContractId: HISTORY_ID,
        documentTypeName: type,
        orderBy: [['$id', 'asc']],
        limit: 100,
        ...(startAfter ? { startAfter } : {}),
      });
    } catch (e) {
      console.log(`${type}: query failed -> ${e.message.slice(0, 120)}`);
      break;
    }
    const entries = [...r];
    if (entries.length === 0) break;
    total += entries.length;
    for (const [, d] of entries) {
      const j = d.toJSON();
      contracts.set(
        j.dataContractId,
        (contracts.get(j.dataContractId) ?? 0) + 1,
      );
    }
    startAfter = entries[entries.length - 1][0];
    if (entries.length < 100) break;
  }
  console.log(`${type}: total=${total}`);
  for (const [c, n] of contracts) {
    console.log(`   ${c} -> ${n} ${c === DPNS_ID ? '<-- DPNS' : ''}`);
  }
}
