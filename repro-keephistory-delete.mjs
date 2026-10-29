// Reproduce: deleting a document whose type has documentsKeepHistory=true.
// Contract 5CBPi... 'note' type has keepHistory=true AND canBeDeleted=true.
//
// Step 1: submit a fresh note document (should succeed).
// Step 2: attempt to delete it. We wrap the delete in a timeout so a true
//         "hang" (never resolves/rejects) is distinguishable from a clean error.
import { Document } from '@dashevo/evo-sdk';
import { setupDashClient } from './setupDashClient.mjs';

const DATA_CONTRACT_ID = '5CBPiadGmx3Zsjc26g5onopcx7pdxHPbrRAUD2T2yAbC';
const DELETE_TIMEOUT_MS = 90_000;

const t = () => new Date().toISOString().slice(11, 23);
const withTimeout = (p, ms, label) =>
  Promise.race([
    p
      .then((v) => ({ kind: 'resolved', v }))
      .catch((e) => ({ kind: 'rejected', e })),
    new Promise((res) =>
      setTimeout(() => res({ kind: 'timeout', ms }), ms).unref?.(),
    ),
  ]);

const { sdk, keyManager } = await setupDashClient();
if (!keyManager) {
  console.error(
    'No keyManager — PLATFORM_MNEMONIC is not set/loaded.\n' +
      'Set it in platform-tutorials/.env (or export it) before running.',
  );
  process.exit(1);
}
const { identity, identityKey, signer } = await keyManager.getAuth();
console.log(`[${t()}] identity:`, identity.id.toJSON());

// ---- Step 1: submit ----
const document = new Document({
  properties: {
    message: `keepHistory delete repro @ ${new Date().toUTCString()}`,
  },
  documentTypeName: 'note',
  dataContractId: DATA_CONTRACT_ID,
  ownerId: identity.id,
});

console.log(`[${t()}] submitting note document...`);
const submitStart = Date.now();
try {
  await sdk.documents.create({ document, identityKey, signer });
} catch (e) {
  console.error(`[${t()}] submit FAILED:`, e.message);
  process.exit(1);
}
const docId = document.toJSON().$id || document.toJSON().id;
console.log(
  `[${t()}] submit OK in ${Date.now() - submitStart}ms. docId: ${docId}`,
);

// ---- Step 2: delete (the operation under test) ----
console.log(`[${t()}] attempting delete (timeout ${DELETE_TIMEOUT_MS}ms)...`);
const delStart = Date.now();
const outcome = await withTimeout(
  sdk.documents.delete({
    document: {
      id: docId,
      ownerId: identity.id,
      dataContractId: DATA_CONTRACT_ID,
      documentTypeName: 'note',
    },
    identityKey,
    signer,
  }),
  DELETE_TIMEOUT_MS,
);
const elapsed = Date.now() - delStart;

console.log(`\n========== DELETE OUTCOME (after ${elapsed}ms) ==========`);
if (outcome.kind === 'resolved') {
  console.log('RESOLVED — delete succeeded (unexpected!).');
} else if (outcome.kind === 'rejected') {
  console.log('REJECTED — clean error returned:');
  console.log('  message:', outcome.e?.message);
  console.log(outcome?.e);
} else {
  console.log(
    `TIMEOUT — delete neither resolved nor rejected within ${outcome.ms}ms.`,
  );
  console.log('  => matches the "hangs on network" symptom.');
}
console.log('==========================================================');
console.log(`docId for reference: ${docId}`);
process.exit(0);
