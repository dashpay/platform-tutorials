//
// Node-only convenience wrapper around setupDashClient-core.mjs.
//
// This file adds the bits that only make sense in Node tutorials:
//   - dotenv loading (PLATFORM_MNEMONIC / NETWORK from .env)
//   - clientConfig (network + mnemonic, sourced from process.env)
//   - setupDashClient() — the one-call wrapper used by tutorial scripts
//
// Everything browser-safe (createClient, IdentityKeyManager, AddressKeyManager,
// dip13KeyPath, KEY_SPECS) is re-exported from setupDashClient-core.mjs so a
// Node tutorial that imports from this file sees an identical API surface.
//
// Browser apps should import from setupDashClient-core.mjs directly.
//
import { wallet } from '@dashevo/evo-sdk';

import {
  createClient,
  dip13KeyPath,
  KEY_SPECS,
  IdentityKeyManager,
  AddressKeyManager,
} from './setupDashClient-core.mjs';

// Load .env if dotenv is installed (optional — not needed for tutorials).
// Top-level await requires ESM — .mjs extension ensures this.
// eslint-disable-next-line import/no-extraneous-dependencies
try {
  const { config } = await import('dotenv');
  config();
} catch {
  /* dotenv not installed */
}

/** @typedef {import('@dashevo/evo-sdk').EvoSDK} EvoSDK */

// ⚠️ Tutorial helper — holds WIFs in memory for convenience.
// Do not use this pattern as-is for production key management.

// ###########################################################################
// #  CONFIGURATION — edit these values for your environment               #
// ###########################################################################
// Option 1: Edit the values below directly
// Option 2: Create a .env file with PLATFORM_MNEMONIC and NETWORK

const clientConfig = {
  // The network to connect to ('testnet' or 'mainnet')
  network: process.env.NETWORK || 'testnet',

  // BIP39 mnemonic for wallet operations (identity & address tutorials).
  // Leave as null for read-only tutorials.
  mnemonic: process.env.PLATFORM_MNEMONIC || null,
  // mnemonic: 'your twelve word mnemonic phrase goes here ...',
};

// ---------------------------------------------------------------------------
// setupDashClient — convenience wrapper
// ---------------------------------------------------------------------------

/**
 * @param {{requireIdentity?: boolean, identityIndex?: number}} opts
 * @returns {Promise<{ sdk: EvoSDK, keyManager: IdentityKeyManager | undefined, addressKeyManager: AddressKeyManager | undefined }>}
 */
export async function setupDashClient({
  requireIdentity = true,
  identityIndex = undefined,
} = {}) {
  const { network, mnemonic } = clientConfig;

  if (mnemonic && !(await wallet.validateMnemonic(mnemonic))) {
    throw new Error(
      'PLATFORM_MNEMONIC is not a valid BIP39 mnemonic. ' +
        'Run `node create-wallet.mjs` to generate one.',
    );
  }

  const sdk = await createClient(network);

  let keyManager;
  let addressKeyManager;

  if (mnemonic) {
    addressKeyManager = await AddressKeyManager.create({
      sdk,
      mnemonic,
      network,
    });

    if (requireIdentity) {
      keyManager = await IdentityKeyManager.create({
        sdk,
        mnemonic,
        network,
        identityIndex,
      });
    } else {
      keyManager = await IdentityKeyManager.createForNewIdentity({
        sdk,
        mnemonic,
        network,
        identityIndex,
      });
    }
  }

  return { sdk, keyManager, addressKeyManager };
}

// Re-export everything from the core so existing imports
// (e.g. `import { IdentityKeyManager } from './setupDashClient.mjs'`) keep working.
export {
  createClient,
  dip13KeyPath,
  KEY_SPECS,
  IdentityKeyManager,
  AddressKeyManager,
  clientConfig,
};
