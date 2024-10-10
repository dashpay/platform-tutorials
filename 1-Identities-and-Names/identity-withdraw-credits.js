// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/withdraw-an-identity-balance.html
const setupDashClient = require('../setupDashClient');

const client = setupDashClient();

const withdrawCredits = async () => {
  const identityId = process.env.IDENTITY_ID; // Your identity ID
  const identity = await client.platform.identities.get(identityId);

  console.log('Identity balance before transfer: ', identity.balance);

  const toAddress = process.env.WITHDRAWAL_ADDRESS; // Destination Dash address
  const amount = 1000000; // Number of credits to withdraw
  const amountDash = amount / (1000 * 100000000);

  console.log(`Withdrawing ${amount} credits (${amountDash} DASH)`);

  // Temporarily force minRelay to have a value so withdrawal succeeds
  // https://github.com/dashpay/platform/issues/2233
  client.wallet.storage.getDefaultChainStore().state.fees.minRelay = 1000;
  // console.log(client.wallet.storage.getDefaultChainStore().state.fees.minRelay)

  const response = await client.platform.identities.withdrawCredits(
    identity,
    amount,
    {
      toAddress,
    },
  );
  console.log(response);
  return client.platform.identities.get(identityId);
};

withdrawCredits()
  .then((d) => console.log('Identity balance after withdrawal: ', d.balance))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
