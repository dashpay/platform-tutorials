const setupDashClient = require('../setupDashClient');

const client = setupDashClient();

const withdrawCredits = async () => {
  const identityId = process.env.IDENTITY_ID; // Your identity ID
  const identity = await client.platform.identities.get(identityId);

  console.log('Identity balance before transfer: ', identity.balance);

  const toAddress = process.env.WITHDRAWAL_ADDRESS; // Destination Dash address
  const withdrawalAmount = 190000; // Number of credits to withdraw

  console.log('Starting credit withdrawal...');

  // Temporarily force minRelay to have a value so withdrawal succeeds
  // https://github.com/dashpay/platform/issues/2233
  client.wallet.storage.getDefaultChainStore().state.fees.minRelay = 1000;
  // console.log(client.wallet.storage.getDefaultChainStore().state.fees.minRelay)

  const metadata = await client.platform.identities.withdrawCredits(
    identity,
    withdrawalAmount,
    {
      toAddress,
    },
  );
  console.log(metadata);
  return client.platform.identities.get(identityId);
};

withdrawCredits()
  .then((d) => console.log('Identity balance after withdrawal: ', d.balance))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
