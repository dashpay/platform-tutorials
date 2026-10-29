import { createClient } from './setupDashClient-core.mjs';

const HISTORY_ID = '6voHRaoiPcfmMhbqCA9dixH98xcgPQ9UEcuaXjpVu3LD';
const DPNS_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec';
const sdk = await createClient('testnet');

const show = (label, v) => {
  try {
    console.log(
      `  ${label}: OK ->`,
      JSON.stringify([...v.entries()], (_k, x) =>
        typeof x === 'bigint' ? `${x}n` : x,
      ),
    );
  } catch {
    console.log(`  ${label}: OK ->`, v);
  }
};

// Which aggregate works on which type? purchase lacks documentsCountable.
for (const type of ['purchase', 'transfer', 'priceUpdate']) {
  console.log(`\n=== ${type} ===`);
  const where = [['dataContractId', '==', DPNS_ID]];

  for (const [name, fn] of [
    [
      'count',
      () =>
        sdk.documents.count({
          dataContractId: HISTORY_ID,
          documentTypeName: type,
          where,
        }),
    ],
    [
      'average(price)',
      () =>
        sdk.documents.average(
          { dataContractId: HISTORY_ID, documentTypeName: type, where },
          'price',
        ),
    ],
    [
      'sum(price)',
      () =>
        sdk.documents.sum(
          { dataContractId: HISTORY_ID, documentTypeName: type, where },
          'price',
        ),
    ],
  ]) {
    try {
      show(name, await fn());
    } catch (e) {
      console.log(`  ${name}: REJECTED -> ${e.message.slice(0, 150)}`);
    }
  }
}

// Can we range-filter purchase by $createdAt (the "30 day" tiles)?
console.log('\n=== purchase 30d range (for SOLD IN 30 DAYS / 30D VOLUME) ===');
const now = 1785876746087; // last known event ts; static (no Date.now in probes is fine here)
const from = now - 30 * 24 * 3600 * 1000;
for (const [name, fn] of [
  [
    'sum 30d',
    () =>
      sdk.documents.sum(
        {
          dataContractId: HISTORY_ID,
          documentTypeName: 'purchase',
          where: [
            ['dataContractId', '==', DPNS_ID],
            ['$createdAt', 'between', [from, now]],
          ],
          orderBy: [['$createdAt', 'asc']],
        },
        'price',
      ),
  ],
  [
    'average 30d',
    () =>
      sdk.documents.average(
        {
          dataContractId: HISTORY_ID,
          documentTypeName: 'purchase',
          where: [
            ['dataContractId', '==', DPNS_ID],
            ['$createdAt', 'between', [from, now]],
          ],
          orderBy: [['$createdAt', 'asc']],
        },
        'price',
      ),
  ],
]) {
  try {
    show(name, await fn());
  } catch (e) {
    console.log(`  ${name}: REJECTED -> ${e.message.slice(0, 150)}`);
  }
}

// byPrice index: highest/lowest sale.
console.log('\n=== purchase byPrice (highest sale) ===');
for (const dir of ['desc', 'asc']) {
  try {
    const r = await sdk.documents.query({
      dataContractId: HISTORY_ID,
      documentTypeName: 'purchase',
      where: [['dataContractId', '==', DPNS_ID]],
      orderBy: [['price', dir]],
      limit: 1,
    });
    console.log(`  orderBy price ${dir}: OK -> ${r.size ?? 0} row(s)`);
  } catch (e) {
    console.log(
      `  orderBy price ${dir}: REJECTED -> ${e.message.slice(0, 130)}`,
    );
  }
}
