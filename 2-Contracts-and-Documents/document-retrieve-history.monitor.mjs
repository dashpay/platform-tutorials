// Throwaway debug variant of document-retrieve-history.mjs — node monitoring.
//
// Context: sdk.documents.history() (getDocumentHistory) is only implemented on
// the one upgraded testnet evonode. Per dashpay/platform#3172 the SDK honors
// neither address pinning nor node banning, so each call round-robins blindly
// across the masternode pool — every attempt is an independent ~1/N dice roll.
//
// This variant keeps firing history() on a single SDK and, by scraping the
// WASM trace logs, records WHICH node each attempt routed to and what it
// returned. At the end it prints a table of unique nodes hit so we can confirm
// whether the upgraded node ever came up — and what it answered when it did.
//
// How the node is captured: the WASM dapi-client logs at trace level go to
// console.*; we wrap those, scan each line for an address/host:port/IP token,
// and remember the most-recent one. The result of each history() call is then
// attributed to whatever node was active during that call.
//
// Run:  node 2-Contracts-and-Documents/document-retrieve-history.monitor.mjs
//
// Optional env:
//   MAX_ATTEMPTS=200    tries before giving up
//   RETRY_DELAY_MS=250  pause between attempts (ms)
//   STOP_ON_SUCCESS=1   stop at first SUCCESS (default); 0 = keep going to map
//                       the whole pool even after the upgraded node answers
//   SHOW_TRACE=0        1 = also pass trace lines through to the console (noisy)
//   DUMP_FIRST=5        print the raw matched trace lines for the first N
//                       attempts so we can confirm/tighten the address regex

import { EvoSDK } from '@dashevo/evo-sdk';
import { setupDashClient } from '../setupDashClient.mjs';

const DATA_CONTRACT_ID = 'Gec4xb6s8NHqLYQXzaLQgxfDyLEqZ7LpjoijQNG3ExK4';
const DOCUMENT_TYPE = 'note';
const DOCUMENT_ID = 'G8HezLu3wKZkXwvLQ6C1jfvuQ2tCAz2vXzAR9EQWcUhT';

const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS || 200);
const RETRY_DELAY_MS = Number(process.env.RETRY_DELAY_MS || 250);
const STOP_ON_SUCCESS = process.env.STOP_ON_SUCCESS !== '0';
const SHOW_TRACE = process.env.SHOW_TRACE === '1';
const DUMP_FIRST = Number(process.env.DUMP_FIRST ?? 5);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Matches https://1.2.3.4:1443 / 1.2.3.4:1443 / bare 1.2.3.4, and host:port.
// Deliberately loose — we verify the real format via DUMP_FIRST on run 1.
const ADDRESS_RE =
  /\b(?:https?:\/\/)?((?:\d{1,3}\.){3}\d{1,3}(?::\d+)?|[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?)\b/gi;

// ---- trace interception -----------------------------------------------------
// The line currently being attributed; updated as trace lines stream in.
let lastSeenAddress = null;
const rawMatchedLines = [];
let dumpedAttempts = 0;

const original = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function scanLine(line) {
  if (typeof line !== 'string') return;
  const matches = line.match(ADDRESS_RE);
  if (!matches) return;
  // Last token on the line is usually the freshest "selected/using" address.
  lastSeenAddress = matches[matches.length - 1];
  if (dumpedAttempts < DUMP_FIRST) rawMatchedLines.push(line.trim());
}

function wrap(name) {
  console[name] = (...args) => {
    for (const a of args) scanLine(a);
    if (SHOW_TRACE) original[name](...args);
  };
}
['log', 'info', 'debug', 'warn', 'error'].forEach(wrap);

// Use the un-wrapped console for our own reporting so it always prints.
const report = (...a) => original.log(...a);

// ---- tally ------------------------------------------------------------------
/** @type {Map<string, {hits:number, success:number, unimplemented:number, other:number}>} */
const nodes = new Map();
const UNKNOWN = '(node not captured)';

function tally(address, kind) {
  const key = address || UNKNOWN;
  const row = nodes.get(key) || {
    hits: 0,
    success: 0,
    unimplemented: 0,
    other: 0,
  };
  row.hits += 1;
  row[kind] += 1;
  nodes.set(key, row);
}

// ---- run --------------------------------------------------------------------
await EvoSDK.setLogLevel('trace');
const { sdk } = await setupDashClient();

const query = {
  dataContractId: DATA_CONTRACT_ID,
  documentTypeName: DOCUMENT_TYPE,
  documentId: DOCUMENT_ID,
};

let firstSuccessAttempt = null;
let history;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  lastSeenAddress = null; // reset so we attribute THIS call's node

  let kind;
  let result;
  try {
    result = await sdk.documents.history(query);
    kind = 'success';
  } catch (e) {
    const msg = e?.message ?? String(e);
    kind = /not implemented or not supported/i.test(msg)
      ? 'unimplemented'
      : 'other';
  }

  const node = lastSeenAddress;
  tally(node, kind);

  const tag =
    kind === 'success'
      ? '✅ SUCCESS'
      : kind === 'unimplemented'
        ? 'UNIMPLEMENTED'
        : 'OTHER';
  report(`attempt ${attempt}/${MAX_ATTEMPTS}: ${tag} via ${node || UNKNOWN}`);

  if (rawMatchedLines.length && dumpedAttempts < DUMP_FIRST) {
    report(`  matched trace lines (attempt ${attempt}):`);
    for (const l of rawMatchedLines) report(`    | ${l}`);
    rawMatchedLines.length = 0;
    dumpedAttempts += 1;
  }

  if (kind === 'success') {
    if (firstSuccessAttempt === null) firstSuccessAttempt = attempt;
    history = result;
    if (STOP_ON_SUCCESS) break;
  }

  if (RETRY_DELAY_MS) await sleep(RETRY_DELAY_MS);
}

// ---- summary ----------------------------------------------------------------
report('\n===== unique nodes hit =====');
const rows = [...nodes.entries()].sort((a, b) => b[1].hits - a[1].hits);
for (const [addr, r] of rows) {
  report(
    `  ${addr.padEnd(28)} hits=${r.hits}  ok=${r.success}  unimpl=${r.unimplemented}  other=${r.other}`,
  );
}
report(`\ndistinct nodes: ${nodes.size}`);
report(
  firstSuccessAttempt
    ? `first SUCCESS on attempt ${firstSuccessAttempt}`
    : `❌ never got a SUCCESS in ${MAX_ATTEMPTS} attempts`,
);

if (history) {
  report('\n===== history =====');
  for (const [ts, doc] of history) {
    report(`  Version at ${ts}:`, doc?.toJSON?.() ?? doc);
  }
}
