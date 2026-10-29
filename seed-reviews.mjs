/**
 * Seed DashRate review activity from a set of mnemonics.
 *
 * Each mnemonic = one identity. The unique `ownerAndResource` index means an
 * identity can leave at most one review per resource, so realistic per-resource
 * distributions come from spreading several identities across the catalog. This
 * script gives every identity a believable, deterministic subset of resources
 * and ratings (mixed 1–5) so the aggregate average, the distribution histogram,
 * and the rating filter all have real data to show.
 *
 * Self-contained: runs with plain `node` like the repo's other tutorials. It
 * deliberately does NOT import the app's .ts source (Node can't resolve the
 * app's extensionless TS imports without a bundler/tsx). The contract id,
 * resource ids, and the create flow are inlined below — keep them in
 * sync with src/dash/contract.ts, src/catalog/resources.ts, and
 * src/dash/review.ts if those change.
 *
 * Usage:
 *   # mnemonics in a file, one per line (blank lines / `#` comments ignored)
 *   node seed-reviews.mjs mnemonics.txt
 *
 *   # or via env (newline- or `;`-separated)
 *   SEED_MNEMONICS="word word ...;word word ..." node seed-reviews.mjs
 *
 * Re-running is safe: if the identity already reviewed a resource, the script
 * logs a skip and leaves the existing review untouched.
 */
import { readFileSync } from 'node:fs';
import { Document, wallet } from '@dashevo/evo-sdk';
import { createClient, IdentityKeyManager } from './setupDashClient-core.mjs';
import { REVIEW_TEXTS } from './seed-data.mjs';

const NETWORK = 'testnet';

// --- Inlined from src/dash/contract.ts -------------------------------------
const CONTRACT_ID = 'BdgTqaTAPYMyhp1WdeWdcvYSgoD7AuJ7tVCaCSXyQgyP';

// --- Inlined from src/catalog/resources.ts (ids only) ----------------------
const RESOURCE_IDS = [
  'intro',
  'identities-names',
  'contracts-documents',
  'tokens',
  'dashnote',
  'dashmint-lab',
  'dashproof-lab',
];

// --- Review creation helpers ----------------------------------------------
// Create on first save for an (identity, resource); skip if one already exists.
async function hasReviewForResource({ sdk, contractId, resourceId, ownerId }) {
  console.log(
    `     [debug] existing-query:start owner=${ownerId} resource=${resourceId}`,
  );
  const results = await sdk.documents.query({
    dataContractId: contractId,
    documentTypeName: 'review',
    where: [
      ['$ownerId', '==', ownerId],
      ['resourceId', '==', resourceId],
    ],
    orderBy: [
      ['$ownerId', 'asc'],
      ['resourceId', 'asc'],
    ],
    limit: 1,
  });
  console.log(
    `     [debug] existing-query:returned shape=${
      Array.isArray(results)
        ? 'array'
        : results instanceof Map
          ? 'map'
          : typeof results
    }`,
  );
  if (Array.isArray(results)) {
    const exists = results.some(Boolean);
    console.log(`     [debug] existing-query:exists=${exists}`);
    return exists;
  }
  const docs =
    results instanceof Map
      ? [...results.values()]
      : Object.values(results ?? {});
  const exists = docs.some(Boolean);
  console.log(`     [debug] existing-query:exists=${exists}`);
  return exists;
}

async function createReviewIfMissing({
  sdk,
  keyManager,
  contractId,
  resourceId,
  rating,
  reviewText,
}) {
  const trimmedText = (reviewText ?? '').trim();
  console.log(
    `     [debug] auth:start resource=${resourceId} rating=${rating}`,
  );
  const { identity, identityKey, signer } = await keyManager.getAuth();
  const ownerId = identity.id.toString();
  console.log(
    `     [debug] auth:done owner=${ownerId} identityKey=${identityKey ? 'present' : 'missing'} signer=${signer ? 'present' : 'missing'}`,
  );
  const exists = await hasReviewForResource({
    sdk,
    contractId,
    resourceId,
    ownerId,
  });

  if (exists) return 'skipped';

  const properties = {
    resourceId,
    rating,
    ...(trimmedText ? { reviewText: trimmedText } : {}),
  };

  console.log(
    `     [debug] document:construct:start properties=${JSON.stringify(properties)}`,
  );
  const document = new Document({
    properties,
    documentTypeName: 'review',
    dataContractId: contractId,
    ownerId: identity.id,
  });
  console.log('     [debug] document:construct:done');
  console.log('     [debug] documents.create:start');
  await sdk.documents.create({ document, identityKey, signer });
  console.log('     [debug] documents.create:done');
  return 'created';
}

// ---------------------------------------------------------------------------
// Collect mnemonics: a file argument (one per line) or SEED_MNEMONICS env.
// ---------------------------------------------------------------------------
function loadMnemonics() {
  const fileArg = process.argv[2];
  let raw = '';
  if (fileArg) {
    raw = readFileSync(fileArg, 'utf8');
  } else if (process.env.SEED_MNEMONICS) {
    raw = process.env.SEED_MNEMONICS.replaceAll(';', '\n');
  } else {
    throw new Error(
      'No mnemonics provided. Pass a file path (one mnemonic per line) ' +
        'or set SEED_MNEMONICS. See the header of this file for usage.',
    );
  }
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

// ---------------------------------------------------------------------------
// Deterministic per-identity plan.
//
// We want uneven, believable coverage rather than every identity reviewing
// every resource. Each identity reviews a rotating window of the catalog so
// the first few "featured" resources accumulate the most reviews (full
// histograms) and the tail trails off — mirroring a real catalog.
//
// Ratings are drawn from a fixed mixed pool offset per identity so the same
// resource collects a spread of star values across reviewers (1–5 represented
// on the busy resources) instead of everyone landing on the same number.
// ---------------------------------------------------------------------------
const MIXED_RATINGS = [5, 4, 5, 3, 4, 2, 5, 4, 3, 1, 4, 5, 3, 2, 4];

function planForIdentity(index, resourceCount) {
  // Each identity reviews ~4–6 resources, starting at a rotating offset so the
  // low-index ("featured") resources are covered most often.
  const span = 4 + (index % 3); // 4, 5, or 6 resources
  const start = index % resourceCount;
  const picks = [];
  for (let step = 0; step < span; step += 1) {
    const resourceIndex = (start + step) % resourceCount;
    // Bias coverage toward the front of the catalog: skip ~1/3 of picks that
    // land in the back half, so the tail resources stay sparse.
    if (resourceIndex > resourceCount / 2 && (index + step) % 3 === 0) continue;
    const rating = MIXED_RATINGS[(index * 3 + step) % MIXED_RATINGS.length];
    picks.push({ resourceIndex, rating });
  }
  return picks;
}

// Pick a review text for a (resource, rating) pair, cycling through the pool so
// repeated (resource, rating) hits across identities vary their wording. No
// pool for the pair → empty string (review submitted with no text).
function pickReviewText(resourceId, rating, occurrence) {
  const pool = REVIEW_TEXTS[resourceId]?.[rating] ?? [];
  if (pool.length === 0) return '';
  return pool[occurrence % pool.length];
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const mnemonics = loadMnemonics();
console.log(
  `Seeding DashRate on ${NETWORK}\n  contract: ${CONTRACT_ID}\n  identities: ${mnemonics.length}\n  resources: ${RESOURCE_IDS.length}\n`,
);

// Track how many times each (resource, rating) has been used so review text
// varies across identities that happen to land on the same pair.
const occurrences = new Map();
let submitted = 0;
let skippedIdentities = 0;
let skippedExisting = 0;
let failed = 0;

const sdk = await createClient(NETWORK);

function errorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}

function isFatalSdkError(err) {
  const message = errorMessage(err);
  return (
    message.includes('Data contract not found') ||
    message.includes('memory access out of bounds')
  );
}

async function preflightContract(sdk) {
  console.log('Preflight: checking contract and review document type...');
  const contract = await sdk.contracts.fetch(CONTRACT_ID);
  if (!contract) {
    throw new Error(`Contract ${CONTRACT_ID} was not found on testnet.`);
  }

  // Also run a harmless document query. This validates the review type/index
  // and warms the SDK's contract path before the first document create.
  await sdk.documents.query({
    dataContractId: CONTRACT_ID,
    documentTypeName: 'review',
    where: [['resourceId', '==', RESOURCE_IDS[0]]],
    orderBy: [['resourceId', 'asc']],
    limit: 1,
  });
}

try {
  await preflightContract(sdk);
} catch (err) {
  console.error(`Preflight failed: ${errorMessage(err)}`);
  process.exit(1);
}

for (let i = 0; i < mnemonics.length; i += 1) {
  const mnemonic = mnemonics[i];
  if (!(await wallet.validateMnemonic(mnemonic))) {
    console.warn(`Identity ${i}: invalid BIP39 mnemonic — skipping.`);
    skippedIdentities += 1;
    continue;
  }

  const plan = planForIdentity(i, RESOURCE_IDS.length);

  let keyManager;
  let identityLabel = `identity ${i}`;
  try {
    keyManager = await IdentityKeyManager.create({
      sdk,
      mnemonic,
      network: NETWORK,
      identityIndex: 0,
    });
    identityLabel = String(keyManager.identityId ?? `identity ${i}`);
  } catch (err) {
    console.warn(
      `Identity ${i}: could not load (is it registered & funded?) — ${err.message}`,
    );
    skippedIdentities += 1;
    continue;
  }

  console.log(`\n[${i}] ${identityLabel} → ${plan.length} reviews`);
  for (const { resourceIndex, rating } of plan) {
    const resourceId = RESOURCE_IDS[resourceIndex];
    const key = `${resourceId}:${rating}`;
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    const reviewText = pickReviewText(resourceId, rating, occurrence);

    try {
      const action = await createReviewIfMissing({
        sdk,
        keyManager,
        contractId: CONTRACT_ID,
        resourceId,
        rating,
        reviewText,
      });
      if (action === 'skipped') {
        console.log(`   - ${resourceId} ${rating}★ (already exists; skipped)`);
        skippedExisting += 1;
      } else {
        console.log(`   ✓ ${resourceId} ${rating}★ (created)`);
        submitted += 1;
      }
    } catch (err) {
      console.error(`   ✗ ${resourceId} ${rating}★ — ${errorMessage(err)}`);
      failed += 1;
      if (isFatalSdkError(err)) {
        console.error(
          'Fatal SDK error; stopping now so later writes do not run against a corrupted WASM state.',
        );
        process.exit(1);
      }
    }
  }
}

console.log(
  `\nDone. submitted ${submitted}, skipped ${skippedExisting} existing reviews, skipped ${skippedIdentities} identities, failed ${failed}.`,
);
