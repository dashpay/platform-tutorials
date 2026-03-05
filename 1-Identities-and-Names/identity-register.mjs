// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/register-an-identity.html
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
  // Known SDK bug: proof verification fails but the identity was created
  // Issue: https://github.com/dashpay/platform/issues/3095
  // Extract the real identity ID from the error message
  const match = e.message?.match(/proof returned identity (\w+) but/);
  if (match) {
    console.log('Identity registered!\nIdentity ID:', match[1]);
  } else {
    console.error('Something went wrong:\n', e.message);
  }
}
