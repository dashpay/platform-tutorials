/**
 * Re-export of IdentityKeyManager from setupDashClient-core.
 *
 * IdentityKeyManager derives the 5 standard DIP-9 identity keys from a
 * BIP39 mnemonic and hands back ready-to-use { identity, identityKey, signer }
 * tuples for each key purpose (auth, authHigh, transfer, master, encryption).
 *
 * This app only ever needs `getAuth()` — submitting a report, editing it,
 * proposing/co-signing a freeze, unfreeze, or destroy, and rotating the
 * panel roster (owner-signed) all sign with the CRITICAL auth key (key 2).
 *
 * `identityIndex` (passed to `IdentityKeyManager.create`/`.createForNewIdentity`)
 * is what lets scripts/bootstrap-identities.mjs derive 4 distinct identities
 * — 1 researcher + 3 panelists — from a single mnemonic: it's a separate
 * DIP-13 path component, so different indices produce genuinely different
 * identities, not just different keys under one identity.
 *
 * SDK methods used internally: wallet.deriveKeyFromSeedWithPath,
 * sdk.identities.byPublicKeyHash, sdk.identities.fetch.
 */
export { IdentityKeyManager } from "../../../../setupDashClient-core.mjs";
