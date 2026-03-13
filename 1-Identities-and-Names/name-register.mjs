// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/register-a-name-for-an-identity.html
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, keyManager } = await setupDashClient();
const { identity, identityKey, signer } = await keyManager.getAuth();

// ⚠️ Change this to a unique name to register
const NAME_LABEL = process.env.NAME_LABEL ?? 'alice';

try {
  // Register a DPNS name for the identity
  const result = await sdk.dpns.registerName({
    label: NAME_LABEL,
    identity,
    identityKey,
    signer,
  });

  console.log('Name registered:\n', result.toJSON());
} catch (e) {
  if (e.message?.includes('duplicate unique properties')) {
    console.error(
      `Name "${NAME_LABEL}.dash" is already registered. Try a different name.`,
    );
  } else {
    console.error('Something went wrong:\n', e.message);
  }
}
