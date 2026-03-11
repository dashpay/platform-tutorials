// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/retrieve-a-name.html
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, keyManager } = await setupDashClient();

// Identity ID from the identity create tutorial
let IDENTITY_ID = 'GgZekwh38XcWQTyWWWvmw6CEYFnLU7yiZFPWZEjqKHit';

// Uncomment the line below to use the identity created in the earlier tutorial
// IDENTITY_ID = keyManager.identityId;

try {
  // Retrieve usernames registered to an identity
  const usernames = await sdk.dpns.usernames({ identityId: IDENTITY_ID });
  console.log(`Name(s) retrieved for ${IDENTITY_ID}:\n`, usernames);
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
