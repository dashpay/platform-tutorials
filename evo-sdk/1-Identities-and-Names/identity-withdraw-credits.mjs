/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/withdraw-an-identity-balance.html
import setupEvoClient from '../setupEvoClient.mjs';

const sdk = setupEvoClient();
await sdk.connect();

const withdrawCredits = async () => {
  const identityId = process.env.IDENTITY_ID; // Your identity ID
  const privateKeyWif = process.env.TRANSFER_KEY_WIF; // Identity's private key
  const toAddress = process.env.WITHDRAWAL_ADDRESS; // Destination Dash address

  // Get identity balance before withdrawal
  const identityBalanceBefore = await sdk.identities.balance(identityId);
  console.log(
    'Identity balance before withdrawal: ',
    identityBalanceBefore.balance,
  );

  const amount = 190000; // Number of credits to withdraw
  const amountDash = amount / (1000 * 100000000);

  console.log(`Withdrawing ${amount} credits (${amountDash} DASH)`);

  // Withdraw credits to Dash address
  await sdk.identities.creditWithdrawal({
    identityId,
    toAddress,
    amount,
    privateKeyWif,
  });

  // Get identity balance after withdrawal
  return sdk.identities.balance(identityId);
};

withdrawCredits()
  .then((d) => console.log('Identity balance after withdrawal: ', d.balance))
  .catch((e) => console.error('Something went wrong:\n', e.message))
  .finally(() => process.exit());
