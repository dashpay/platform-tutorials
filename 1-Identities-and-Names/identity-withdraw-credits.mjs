// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/withdraw-an-identity-balance.html
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, keyManager } = await setupDashClient();
const { identity, signer } = await keyManager.getTransfer();

console.log('Identity balance before withdrawal:', identity.balance);

// Default: testnet faucet address. Replace or override via WITHDRAWAL_ADDRESS.
const toAddress =
  process.env.WITHDRAWAL_ADDRESS ?? 'yXWJGWuD4VBRMp9n2MtXQbGpgSeWyTRHme';
const amount = 190000n; // Credits to withdraw
const amountDash = Number(amount) / (1000 * 100000000);

console.log(`Withdrawing ${amount} credits (${amountDash} DASH)`);

try {
  const remainingBalance = await sdk.identities.creditWithdrawal({
    identity,
    amount,
    toAddress,
    signer,
  });

  console.log(`Identity balance after withdrawal: ${remainingBalance} credits`);
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
