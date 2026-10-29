// Diagnostic copy of document-retrieve-history.mjs
//
// Goal: capture the FULL error + trace logs for sdk.documents.history(),
// which returns gRPC "Operation is not implemented or not supported" even
// though grpcurl/grpcui (native gRPC) and a hand-built grpc-web POST both
// succeed against the same node:port for getDocumentHistory.
//
// Run:  DAPI_ADDRESS=68.67.122.7 node 2-Contracts-and-Documents/document-retrieve-history.debug.mjs
//
// Optional overrides:
//   SDK_VERSION=11   (platform version override; setupDashClient-core pins 11)
//   SDK_VERSION=none (do NOT pin a version — let the SDK negotiate)
//   SDK_PROOFS=false (request without proofs)
//   LOG=trace        (wasm log level: trace|debug|info|warn|error)

import { EvoSDK, wallet } from '@dashevo/evo-sdk';

const DATA_CONTRACT_ID = 'Gec4xb6s8NHqLYQXzaLQgxfDyLEqZ7LpjoijQNG3ExK4';
const DOCUMENT_TYPE = 'note';
const DOCUMENT_ID = 'G8HezLu3wKZkXwvLQ6C1jfvuQ2tCAz2vXzAR9EQWcUhT';

const LOG = process.env.LOG || 'trace';
const SDK_PROOFS = process.env.SDK_PROOFS; // 'true' | 'false' | undefined
const RAW_VERSION = process.env.SDK_VERSION ?? '11';

function normalizeDapiAddress(address) {
  if (/^https?:\/\//.test(address)) return address;
  return `https://${address}:1443`;
}

const dapiRaw = process.env.DAPI_ADDRESSES || process.env.DAPI_ADDRESS || '';
const addresses = dapiRaw
  .split(',')
  .map((a) => a.trim())
  .filter(Boolean)
  .map(normalizeDapiAddress);

console.log('--- config ---');
console.log('addresses        :', addresses);
console.log('SDK_VERSION (raw):', RAW_VERSION);
console.log('SDK_PROOFS       :', SDK_PROOFS ?? '(default)');
console.log('LOG              :', LOG);

// Turn on WASM-side trace logging BEFORE building the SDK.
try {
  await EvoSDK.setLogLevel(LOG);
  console.log('setLogLevel ok   :', LOG);
} catch (e) {
  console.log('setLogLevel FAILED:', e?.message ?? e);
}

const TRUSTED = process.env.SDK_TRUSTED !== 'false'; // default true; set false to pin addresses

const options = {
  network: 'testnet',
  trusted: TRUSTED,
  addresses,
  logs: LOG,
};

// Version pin is the prime suspect — make it toggleable.
if (RAW_VERSION !== 'none' && RAW_VERSION !== '') {
  options.version = Number(RAW_VERSION);
}
if (SDK_PROOFS === 'true') options.proofs = true;
if (SDK_PROOFS === 'false') options.proofs = false;

console.log('\n--- EvoSDK options ---');
console.log(options);

const sdk = new EvoSDK(options);
await sdk.connect();

try {
  const negotiated = sdk.version?.();
  console.log('\nsdk.version()    :', negotiated);
} catch (e) {
  console.log('\nsdk.version() err:', e?.message ?? e);
}

function dumpError(label, e) {
  console.error(`\n===== ${label} =====`);
  console.error('typeof           :', typeof e);
  console.error('constructor      :', e?.constructor?.name);
  console.error('message          :', e?.message);
  console.error('code             :', e?.code);
  console.error('name             :', e?.name);
  console.error('cause            :', e?.cause);
  // Enumerate own props (wasm errors often stash data in non-standard fields)
  try {
    const own = {};
    for (const k of Object.getOwnPropertyNames(e || {})) {
      if (k === 'stack') continue;
      own[k] = e[k];
    }
    console.error('ownProps         :', own);
  } catch (inner) {
    console.error('ownProps err     :', inner?.message);
  }
  try {
    console.error('JSON             :', JSON.stringify(e));
  } catch {
    /* not serializable */
  }
  console.error('toString         :', String(e));
  console.error('stack            :\n', e?.stack);
}

// Brute-force: retry history on the SAME sdk instance. Nodes that fail get
// banned by the dapi-client for this sdk's lifetime, so the address pool
// shrinks toward the one upgraded node (.7) on each Unimplemented.
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS || 60);

let history;
for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  try {
    history = await sdk.documents.history({
      dataContractId: DATA_CONTRACT_ID,
      documentTypeName: DOCUMENT_TYPE,
      documentId: DOCUMENT_ID,
    });
    console.log(
      `\n✅ SUCCESS on attempt ${attempt}, entries: ${history?.size ?? history}`,
    );
    break;
  } catch (e) {
    const msg = e?.message ?? String(e);
    const kind = /not implemented or not supported/i.test(msg)
      ? 'UNIMPLEMENTED'
      : /no available addresses/i.test(msg)
        ? 'POOL_EXHAUSTED'
        : 'OTHER';
    console.log(`attempt ${attempt}: ${kind} — ${msg.slice(0, 120)}`);
    if (kind === 'POOL_EXHAUSTED') {
      // All non-banned nodes failed for this sdk; nothing left to try.
      console.log('All nodes banned/exhausted for this sdk instance.');
      break;
    }
  }
}

if (history) {
  for (const [ts, doc] of history) {
    console.log(`  Version at ${ts}:`, doc?.toJSON?.() ?? doc);
  }
} else {
  console.log(
    '\n❌ Never hit the upgraded node within',
    MAX_ATTEMPTS,
    'attempts.',
  );
}
