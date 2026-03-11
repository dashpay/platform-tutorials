// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/retrieve-an-identity.html
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, keyManager } = await setupDashClient();

// Identity ID from the identity create tutorial
const IDENTITY_ID = keyManager.identityId;

if (!IDENTITY_ID) {
  throw new Error(
    'No identity found. Run the "Register an Identity" tutorial first or provide an identity ID.',
  );
}

try {
  const identity = await sdk.identities.fetch(IDENTITY_ID);
  console.log('Identity retrieved:\n', identity.toJSON());
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
