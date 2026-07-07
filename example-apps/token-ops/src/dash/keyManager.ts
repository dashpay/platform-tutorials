/**
 * Re-export of IdentityKeyManager from setupDashClient-core.
 *
 * IdentityKeyManager derives the 5 standard DIP-9 identity keys from a
 * BIP39 mnemonic and hands back ready-to-use { identity, identityKey, signer }
 * tuples for each key purpose (auth, authHigh, transfer, master, encryption).
 *
 * This app only ever needs `getAuth()` — token operations, group actions, and
 * config updates all sign with the CRITICAL auth key (key 2).
 *
 * `identityIndex` (passed to `IdentityKeyManager.create`/`.createForNewIdentity`)
 * is what lets scripts/bootstrap-identities.mjs derive 4 distinct identities
 * — 1 owner + 3 group members — from a single mnemonic: it's a separate
 * DIP-13 path component, so different indices produce genuinely different
 * identities, not just different keys under one identity.
 *
 * SDK methods used internally: wallet.deriveKeyFromSeedWithPath,
 * sdk.identities.byPublicKeyHash, sdk.identities.fetch.
 */
export { IdentityKeyManager } from "../../../../setupDashClient-core.mjs";
