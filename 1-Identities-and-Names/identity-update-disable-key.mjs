// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/update-an-identity.html
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, keyManager } = await setupDashClient();
const { identity, signer } = await keyManager.getMaster();

// Replace with one of the identity's existing public key IDs
const DISABLE_KEY_ID = Number(process.env.DISABLE_KEY_ID ?? 99);

console.log(
  `Disabling key ${DISABLE_KEY_ID} on identity ${keyManager.identityId}...`,
);

try {
  await sdk.identities.update({
    identity,
    disablePublicKeys: [DISABLE_KEY_ID],
    signer,
  });

  const updatedIdentity = await sdk.identities.fetch(keyManager.identityId);
  console.log('Identity updated:\n', updatedIdentity.toJSON());
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
