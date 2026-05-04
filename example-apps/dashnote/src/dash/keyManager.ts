/**
 * Re-export of IdentityKeyManager from the shared browser-safe SDK core.
 *
 * IdentityKeyManager derives the standard identity keys from a BIP39 mnemonic
 * and exposes getAuth(), which is all this app needs for document creation and
 * contract publication.
 */
export { IdentityKeyManager } from "../../../../setupDashClient-core.mjs";
