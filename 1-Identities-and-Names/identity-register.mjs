import { randomBytes } from 'node:crypto';
import { Identity, Identifier } from '@dashevo/evo-sdk';
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, keyManager, addressKeyManager } = await setupDashClient({ requireIdentity: false });

try {
  // Build the identity shell with 5 standard public keys
  const identity = new Identity(new Identifier(randomBytes(32)));
  keyManager.getKeysInCreation().forEach((key) => {
    identity.addPublicKey(key.toIdentityPublicKey());
  });

  // Create the identity on-chain, funded from the platform address
  const result = await sdk.addresses.createIdentity({
    identity,
    inputs: [{
      address: addressKeyManager.primaryAddress.bech32m,
      amount: 5000000n, // Credits to fund the new identity
    }],
    identitySigner: keyManager.getFullSigner(),
    addressSigner: addressKeyManager.getSigner(),
  });

  console.log('Identity registered!\nIdentity ID:', result.identity.id.toString());
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}