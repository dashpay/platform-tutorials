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
const t = async (label, fn) => {
  try {
    show(label, await fn());
  } catch (e) {
    console.log(`  ${label}: FAIL -> ${e.message.slice(0, 155)}`);
  }
};

// priceUpdate HAS 3 real records under DPNS, so a non-empty aggregate should
// succeed here if the query shape is right. This isolates shape-vs-empty.
console.log('=== priceUpdate (3 real DPNS records) — shape variants ===');
const base = { dataContractId: HISTORY_ID, documentTypeName: 'priceUpdate' };
const w = [['dataContractId', '==', DPNS_ID]];

await t('average, where only, no orderBy', () =>
  sdk.documents.average({ ...base, where: w }, 'price'),
);
await t('average, where + orderBy $createdAt', () =>
  sdk.documents.average(
    { ...base, where: w, orderBy: [['$createdAt', 'asc']] },
    'price',
  ),
);
await t('sum, where only', () =>
  sdk.documents.sum({ ...base, where: w }, 'price'),
);
await t('count, where only', () => sdk.documents.count({ ...base, where: w }));

// transfer is countable (1 real record) — count should work if shape is right.
console.log('\n=== transfer (1 real DPNS record, countable) ===');
const tb = { dataContractId: HISTORY_ID, documentTypeName: 'transfer' };
await t('count, where only', () => sdk.documents.count({ ...tb, where: w }));
await t('count, where + orderBy', () =>
  sdk.documents.count({ ...tb, where: w, orderBy: [['$createdAt', 'asc']] }),
);
await t('count, $createdAt between', () =>
  sdk.documents.count({
    ...tb,
    where: [...w, ['$createdAt', 'between', [0, 1785876746088]]],
    orderBy: [['$createdAt', 'asc']],
  }),
);

// Does plain query+client-side math work as the fallback? (it must)
console.log('\n=== fallback: plain query, client-side aggregate ===');
await t('query priceUpdate rows', async () => {
  const r = await sdk.documents.query({
    ...base,
    where: w,
    orderBy: [['$createdAt', 'asc']],
    limit: 100,
  });
  const prices = [...r.values()].map((d) => Number(d.toJSON().price));
  const nonZero = prices.filter((p) => p > 0);
  return new Map([
    ['rows', r.size],
    ['sum', prices.reduce((a, b) => a + b, 0)],
    [
      'avgNonZero',
      nonZero.length ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0,
    ],
  ]);
});
