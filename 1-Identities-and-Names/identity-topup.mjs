// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/topup-an-identity-balance.html
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, addressKeyManager, keyManager } = await setupDashClient();
const signer = addressKeyManager.getSigner();

try {
  // Identity ID from the identity create tutorial
  const IDENTITY_ID = keyManager.identityId;
  const identity = await sdk.identities.fetch(IDENTITY_ID);

  const result = await sdk.addresses.topUpIdentity({
    identity,
    inputs: [{
      address: addressKeyManager.primaryAddress.bech32m,
      amount: 200000n, // Credits to transfer
    }],
    signer,
  });

  console.log(`Top-up result:
  Start balance: ${identity.toJSON().balance}
  Final balance: ${result.newBalance}`);
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
