// Throwaway debug variant of document-retrieve-history.mjs
//
// Context: sdk.documents.history() (getDocumentHistory) is only implemented on
// the one upgraded testnet evonode. The SDK round-robins the masternode pool
// and — per dashpay/platform#3172 — honors NEITHER address pinning NOR node
// banning, so we can't steer toward the upgraded node and we can't shrink the
// pool by banning the others. Every call is an independent ~1/N dice roll.
//
// Strategy: build a FRESH SDK per attempt (no shared state to skew routing,
// no bogus POOL_EXHAUSTED early-exit) and keep firing until one lands on the
// upgraded node and returns history instead of UNIMPLEMENTED.
//
// Run:  node 2-Contracts-and-Documents/document-retrieve-history.retry.mjs
//
// Optional env:
//   MAX_ATTEMPTS=200   how many independent tries before giving up
//   RETRY_DELAY_MS=0   pause between attempts (ms)

import { setupDashClient } from '../setupDashClient.mjs';

const DATA_CONTRACT_ID = 'Gec4xb6s8NHqLYQXzaLQgxfDyLEqZ7LpjoijQNG3ExK4';
const DOCUMENT_TYPE = 'note';
const DOCUMENT_ID = 'G8HezLu3wKZkXwvLQ6C1jfvuQ2tCAz2vXzAR9EQWcUhT';

const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS || 200);
const RETRY_DELAY_MS = Number(process.env.RETRY_DELAY_MS || 250);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const query = {
  dataContractId: DATA_CONTRACT_ID,
  documentTypeName: DOCUMENT_TYPE,
  documentId: DOCUMENT_ID,
};

let history;
let attempts = 0;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  attempts = attempt;
  // Fresh SDK every attempt: per #3172, pinning/banning are no-ops, so a shared
  // instance buys us nothing and can only carry stale routing state. A clean
  // connect re-rolls the node selection independently each time.
  let sdk;
  try {
    ({ sdk } = await setupDashClient());

    history = await sdk.documents.history(query);
    console.log(
      `\n✅ SUCCESS on attempt ${attempt}, entries: ${history?.size ?? 0}`,
    );
    break;
  } catch (e) {
    const msg = e?.message ?? String(e);
    const kind = /not implemented or not supported/i.test(msg)
      ? 'UNIMPLEMENTED'
      : 'OTHER';
    console.log(
      `attempt ${attempt}/${MAX_ATTEMPTS}: ${kind} — ${msg.slice(0, 120)}`,
    );
  } finally {
    // Best-effort cleanup so we don't leak connections across hundreds of tries.
    try {
      await sdk?.disconnect?.();
    } catch {
      /* ignore */
    }
  }

  if (RETRY_DELAY_MS) await sleep(RETRY_DELAY_MS);
}

if (history) {
  // history() resolves to Map<bigint timestamp, Document> directly.
  for (const [ts, doc] of history) {
    console.log(`  Version at ${ts}:`, doc?.toJSON?.() ?? doc);
  }
} else {
  console.log(`\n❌ Never hit the upgraded node within ${attempts} attempts.`);
}
