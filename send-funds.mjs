// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/send-funds.html
import { setupDashClient } from './setupDashClient.mjs';

const { sdk, addressKeyManager } = await setupDashClient();
const signer = addressKeyManager.getSigner();

const recipient =
  process.env.RECIPIENT_PLATFORM_ADDRESS ||
  'tdash1kr2ygqnqvsms509f78t4v3uqmce2re22jqycaxh4';
const amount = 500000n; // 0.000005 DASH

try {
  const result = await sdk.addresses.transfer({
    inputs: [
      {
        address: addressKeyManager.primaryAddress.bech32m,
        amount,
      },
    ],
    outputs: [
      {
        address: recipient,
        amount,
      },
    ],
    signer,
  });
  console.log(`Transaction broadcast! Sent ${amount} credits to ${recipient}`);
  for (const [address, info] of result) {
    const addr =
      typeof address === 'string' ? address : address.toBech32m('testnet');
    console.log(`  ${addr}: ${info.balance} credits (nonce: ${info.nonce})`);
  }
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
