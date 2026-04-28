/**
 * Re-export of IdentityKeyManager from setupDashClient-core.
 *
 * IdentityKeyManager derives the 5 standard DIP-9 identity keys from a
 * BIP39 mnemonic and hands back ready-to-use { identity, identityKey, signer }
 * tuples for each key purpose (auth, authHigh, transfer, master, encryption).
 *
 * For this app we only ever need `getAuth()` — every card mutation
 * (mint / transfer / setPrice / purchase / burn) signs with the CRITICAL
 * auth key (key 2). See the note in nft/CLAUDE.md: transfer operations use
 * the AUTHENTICATION key, not the TRANSFER purpose key, despite the name.
 *
 * SDK methods used internally: wallet.deriveKeyFromSeedWithPath,
 * sdk.identities.byPublicKeyHash, sdk.identities.fetch.
 */
export { IdentityKeyManager } from "../../../../setupDashClient-core.mjs";
