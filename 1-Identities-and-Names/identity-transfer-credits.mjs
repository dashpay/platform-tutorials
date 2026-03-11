// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/transfer-credits-to-an-identity.html
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, keyManager } = await setupDashClient();
const { identity, signer } = await keyManager.getTransfer();

// Default recipient (testnet). Replace or override via RECIPIENT_ID.
const recipientId =
  process.env.RECIPIENT_ID ?? '7XcruVSsGQVSgTcmPewaE4tXLutnW1F6PXxwMbo8GYQC';
const transferAmount = 100000n; // Credits to transfer

try {
  await sdk.identities.creditTransfer({
    identity,
    recipientId,
    amount: transferAmount,
    signer,
  });

  const recipient = await sdk.identities.fetch(recipientId);
  console.log('Recipient identity balance after transfer:', recipient.balance);
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
