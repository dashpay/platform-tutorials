import { describe, it } from 'node:test';
import dotenv from 'dotenv';
import { runTutorial } from './run-tutorial.mjs';
import { assertTutorialSuccess } from './assertions.mjs';

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
