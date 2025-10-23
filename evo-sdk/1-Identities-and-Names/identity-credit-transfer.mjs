/* eslint-disable no-console */
// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/transfer-credits-to-an-identity.html
import setupEvoClient from '../setupEvoClient.mjs';

const sdk = setupEvoClient();
await sdk.connect();

const transferCredits = async () => {
  const senderId = process.env.IDENTITY_ID; // Your identity ID
  const recipientId = process.env.RECIPIENT_ID; // Recipient's ID
  const privateKeyWif = process.env.TRANSFER_KEY_WIF; // Sender's private key

  const recipientBalance = await sdk.identities.balance(recipientId);
  console.log(
    'Recipient identity balance before transfer: ',
    recipientBalance.balance,
  );

  const amount = 100000; // Number of credits to transfer

  await sdk.identities.creditTransfer({
    senderId,
    recipientId,
    amount,
    privateKeyWif,
  });

  return sdk.identities.balance(recipientId);
};

transferCredits()
  .then((d) => console.log('Recipient balance after transfer: ', d.balance))
  .catch((e) => console.error('Something went wrong:\n', e.message))
  .finally(() => process.exit());
