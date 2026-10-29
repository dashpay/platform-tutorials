// Register a new Dash Platform identity and a DPNS name on mainnet.
//
// Required environment variables:
//   NETWORK=mainnet
//   PLATFORM_MNEMONIC="..."
//   NAME_LABEL=your-unique-name
//
// The mnemonic's first available DIP-13 identity index is used. Its primary
// mainnet Platform address must already contain enough funds.
import { randomBytes } from 'node:crypto';
import { Identity, Identifier } from '@dashevo/evo-sdk';
import { clientConfig, setupDashClient } from '../setupDashClient.mjs';

const NAME_LABEL = process.env.NAME_LABEL?.trim().toLowerCase();
const IDENTITY_CREDITS = 5000000n;

if (clientConfig.network !== 'mainnet') {
  throw new Error(
    'Refusing to run: set NETWORK=mainnet explicitly in .env or the environment.',
  );
}

if (!process.env.PLATFORM_MNEMONIC) {
  throw new Error('PLATFORM_MNEMONIC is required.');
}

if (!NAME_LABEL) {
  throw new Error(
    'NAME_LABEL is required (provide the label without ".dash").',
  );
}

const { sdk, keyManager, addressKeyManager } = await setupDashClient({
  requireIdentity: false,
});

if (!keyManager || !addressKeyManager) {
  throw new Error('Could not initialize the mnemonic key managers.');
}

try {
  if (!(await sdk.dpns.isValidUsername(NAME_LABEL))) {
    throw new Error(`"${NAME_LABEL}" is not a valid DPNS name label.`);
  }

  if (await sdk.dpns.isContestedUsername(NAME_LABEL)) {
    throw new Error(
      `"${NAME_LABEL}.dash" is contested and cannot use simple registration.`,
    );
  }

  if (!(await sdk.dpns.isNameAvailable(NAME_LABEL))) {
    throw new Error(`"${NAME_LABEL}.dash" is already registered.`);
  }

  const identity = new Identity(new Identifier(randomBytes(32)));
  keyManager.getKeysInCreation().forEach((key) => {
    identity.addPublicKey(key.toIdentityPublicKey());
  });

  let registeredIdentity;

  try {
    const result = await sdk.addresses.createIdentity({
      identity,
      inputs: [
        {
          address: addressKeyManager.primaryAddress.bech32m,
          amount: IDENTITY_CREDITS,
        },
      ],
      identitySigner: keyManager.getFullSigner(),
      addressSigner: addressKeyManager.getSigner(),
    });
    registeredIdentity = result.identity;
  } catch (error) {
    // Work around a known SDK proof-verification error that can occur after a
    // successful identity registration.
    const match = error.message?.match(/proof returned identity (\w+) but/);
    if (!match) throw error;

    registeredIdentity = await sdk.identities.fetch(match[1]);
    if (!registeredIdentity) {
      throw new Error(
        `Identity ${match[1]} was reported as registered but could not be fetched.`,
      );
    }
  }

  const identityId = registeredIdentity.id.toString();
  const identityKey = registeredIdentity.getPublicKeyById(2);
  if (!identityKey) {
    throw new Error(`Identity ${identityId} does not contain auth key 2.`);
  }

  console.log('Identity registered.');
  console.log('Identity ID:', identityId);

  const nameResult = await sdk.dpns.registerName({
    label: NAME_LABEL,
    identity: registeredIdentity,
    identityKey,
    signer: keyManager.getFullSigner(),
  });

  console.log(`Name registered: ${NAME_LABEL}.dash`);
  console.log(nameResult.toJSON());
} catch (error) {
  console.error('Registration failed:', error.message);
  process.exitCode = 1;
}
