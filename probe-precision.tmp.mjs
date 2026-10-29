/**
 * Confirm on evo-sdk 4.1.0 whether `document.properties` is a lossless
 * accessor for prices above Number.MAX_SAFE_INTEGER, given that
 * Document.toJSON() throws (dashpay/platform#3786).
 */
import { createClient } from './setupDashClient-core.mjs';

const CONTRACT_ID = 'CkAX4amndy33YxCyQ3op4QmWofsiW9TukoMh2nvHQk9B';
const sdk = await createClient('testnet');

const r = await sdk.documents.query({
  dataContractId: CONTRACT_ID,
  documentTypeName: 'card',
  limit: 100,
});

const entries = r instanceof Map ? [...r.entries()] : Object.entries(r ?? {});
console.log(`fetched ${entries.length} card(s)\n`);

let bad = 0;
for (const [id, doc] of entries) {
  let jsonPrice = '(no $price)';
  let threw = null;
  try {
    const j = doc.toJSON();
    jsonPrice =
      j.$price === undefined
        ? '(no $price)'
        : `${j.$price} [${typeof j.$price}]`;
  } catch (e) {
    threw = `${e?.constructor?.name}: ${String(e?.message).slice(0, 60)}`;
  }

  let propPrice = '(none)';
  try {
    const p = doc.properties;
    const v = p?.$price;
    propPrice = v === undefined ? '(none)' : `${v} [${typeof v}]`;
  } catch (e) {
    propPrice = `<threw ${String(e?.message).slice(0, 40)}>`;
  }

  if (threw || (propPrice !== '(none)' && propPrice !== '(no $price)')) {
    bad++;
    console.log(`doc ${id}`);
    console.log(`  toJSON()   : ${threw ? 'THREW -> ' + threw : jsonPrice}`);
    console.log(`  .properties: ${propPrice}`);
  }
}
console.log(`\n${bad} doc(s) with a price or a toJSON failure`);
console.log(`MAX_SAFE_INTEGER = ${Number.MAX_SAFE_INTEGER}`);
