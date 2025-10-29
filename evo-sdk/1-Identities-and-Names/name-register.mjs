/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/register-a-name-for-an-identity.html
import setupEvoClient from '../setupEvoClient.mjs';

const sdk = setupEvoClient();
await sdk.connect();

const registerName = async () => {
  const identityId = process.env.IDENTITY_ID; // Your identity ID
  const privateKeyWif = process.env.CRITICAL_KEY_WIF; // Identity's private key
  // Generate a unique label (20+ chars to avoid contested namespace)
  const label = process.env.NAME_LABEL || `tutorial-${Date.now()}`; // Username (without .dash)

  console.log(`Registering name: ${label}.dash`);

  // Register the DPNS name
  // The SDK handles the preorder/register flow internally
  const result = await sdk.dpns.registerName({
    label,
    identityId,
    publicKeyId: 1,
    privateKeyWif,
    // Optional callback to see preorder confirmation
    onPreorder: (preorderTxId) => {
      console.log('Preorder transaction ID:', preorderTxId);
    },
  });

  return result;
};

registerName()
  .then((d) => console.log('Name registered successfully:\n', d))
  .catch((e) => console.error('Something went wrong:\n', e.message))
  .finally(() => process.exit());
