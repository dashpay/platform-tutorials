import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import dotenv from 'dotenv';
import { EvoSDK } from '@dashevo/evo-sdk';
import { runTutorial } from './run-tutorial.mjs';
import { assertTutorialSuccess } from './assertions.mjs';
import { createClient } from '../setupDashClient-core.mjs';

dotenv.config();

const tutorials = [
  {
    path: 'connect.mjs',
    name: 'connect',
    expectedPatterns: ['Connected\\. System status:'],
    errorPatterns: ['Failed to fetch'],
    timeoutMs: 30_000,
  },
  {
    path: 'create-wallet.mjs',
    name: 'create-wallet',
    expectedPatterns: ['Mnemonic:', 'Platform address:'],
    errorPatterns: ['Something went wrong'],
    timeoutMs: 30_000,
  },
  {
    path: '1-Identities-and-Names/identity-retrieve.mjs',
    name: 'identity-retrieve',
    expectedPatterns: ['Identity retrieved:'],
    errorPatterns: ['Something went wrong'],
    requiresMnemonic: true,
  },
  {
    path: '1-Identities-and-Names/name-resolve-by-name.mjs',
    name: 'name-resolve-by-name',
    expectedPatterns: ['Identity ID for'],
    errorPatterns: ['Something went wrong'],
  },
  {
    path: '1-Identities-and-Names/name-search-by-name.mjs',
    name: 'name-search-by-name',
    expectedPatterns: ['\\.dash'],
    errorPatterns: ['Something went wrong'],
  },
  {
    path: '1-Identities-and-Names/name-get-identity-names.mjs',
    name: 'name-get-identity-names',
    expectedPatterns: ['Name\\(s\\) retrieved'],
    errorPatterns: ['Something went wrong'],
  },
  {
    path: '2-Contracts-and-Documents/contract-retrieve.mjs',
    name: 'contract-retrieve',
    expectedPatterns: ['Contract retrieved:'],
    errorPatterns: ['Something went wrong'],
  },
  {
    path: '2-Contracts-and-Documents/contract-retrieve-history.mjs',
    name: 'contract-retrieve-history',
    expectedPatterns: ['Version at'],
    errorPatterns: ['Something went wrong'],
  },
  {
    path: '2-Contracts-and-Documents/document-retrieve.mjs',
    name: 'document-retrieve',
    expectedPatterns: ['Document:'],
    errorPatterns: ['Something went wrong'],
  },
];

const hasMnemonic = !!process.env.PLATFORM_MNEMONIC;

describe('Read-only tutorials', () => {
  for (const entry of tutorials) {
    const testFn = entry.requiresMnemonic && !hasMnemonic ? it.skip : it;
    testFn(entry.name, { timeout: entry.timeoutMs ?? 120_000 }, async () => {
      const result = await runTutorial(entry.path, {
        env: entry.env,
        timeoutMs: entry.timeoutMs,
      });
      assertTutorialSuccess(result, entry);
    });
  }
});

// DPNS — a system contract, so it exists on every network and needs no fixture.
const DPNS_CONTRACT_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec';

describe('Platform protocol version', () => {
  // Regression guard for #112: createClient() must leave the protocol version
  // unpinned so the SDK negotiates it. A hardcoded pin disables negotiation
  // silently — no error, no warning — and the client stays on the old version
  // forever once the network upgrades.
  it('negotiates the version instead of using a hardcoded pin', async () => {
    const network = process.env.NETWORK || 'testnet';
    const sdk = await createClient(network);

    // status() hands back a WASM handle — the fields are only reachable
    // through toJSON().
    const status = (await sdk.system.status()).toJSON();
    const networkVersion = Number(status.version.protocol.drive.current);
    const sdkNewestKnown = await EvoSDK.getLatestVersionNumber();

    // A proof-bearing read is what carries the network's version back to the
    // client; the negotiated value is only settled after the first one.
    await sdk.contracts.fetch(DPNS_CONTRACT_ID);

    // The client should land on the network's active version, except when the
    // network has moved past what this SDK release understands — then it stays
    // at its own ceiling. Asserting against the min() of the two keeps this
    // test honest without turning every network upgrade into a red build.
    assert.equal(
      sdk.version(),
      Math.min(networkVersion, sdkNewestKnown),
      `client settled on protocol version ${sdk.version()}, but the network ` +
        `is on ${networkVersion} and this SDK understands up to ` +
        `${sdkNewestKnown} — check for a reintroduced version pin`,
    );
  });
});
