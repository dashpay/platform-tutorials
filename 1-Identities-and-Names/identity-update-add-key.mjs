// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/update-an-identity.html
import {
  IdentityPublicKeyInCreation,
  KeyType,
  Purpose,
  SecurityLevel,
  wallet,
} from '@dashevo/evo-sdk';
import { setupDashClient, clientConfig, dip13KeyPath } from '../setupDashClient.mjs';

const { sdk, keyManager } = await setupDashClient();

// Fetch identity to determine the next available key ID
const { identity, signer } = await keyManager.getMaster();
const existingKeys = identity.toJSON().publicKeys;
const newKeyId = Math.max(...existingKeys.map((k) => k.id)) + 1;

console.log(`Adding key ${newKeyId} to identity ${keyManager.identityId}...`);

// Derive the new key using the standard DIP-13 path
const newKeyPath = await dip13KeyPath(
  clientConfig.network,
  keyManager.identityIndex,
  newKeyId,
);
const newKeyInfo = await wallet.deriveKeyFromSeedWithPath({
  mnemonic: clientConfig.mnemonic,
  path: newKeyPath,
  network: clientConfig.network,
});
const newKeyObj = newKeyInfo.toObject();

// Build the new public key
const newPublicKey = new IdentityPublicKeyInCreation({
  keyId: newKeyId,
  purpose: Purpose.AUTHENTICATION,
  securityLevel: SecurityLevel.HIGH,
  keyType: KeyType.ECDSA_SECP256K1,
  data: Uint8Array.from(Buffer.from(newKeyObj.publicKey, 'hex')),
});

// Add the new key's WIF to the signer so it can co-sign
signer.addKeyFromWif(newKeyObj.privateKeyWif);

try {
  await sdk.identities.update({
    identity,
    addPublicKeys: [newPublicKey],
    signer,
  });

  const updatedIdentity = await sdk.identities.fetch(keyManager.identityId);
  console.log('Identity updated:\n', updatedIdentity.toJSON());
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
