// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/transfer-tokens-to-an-identity.html
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, keyManager } = await setupDashClient();
const { identity, identityKey, signer } = await keyManager.getTransfer();

// TOKEN_CONTRACT_ID comes from contract-register-token.mjs.
const dataContractId = process.env.TOKEN_CONTRACT_ID;
const tokenPosition = 0;

// Default recipient (testnet). Replace or override via RECIPIENT_ID.
const recipientId =
  process.env.RECIPIENT_ID || '7XcruVSsGQVSgTcmPewaE4tXLutnW1F6PXxwMbo8GYQC';
const amount = 1n;

try {
  if (!dataContractId) {
    throw new Error(
      'Set TOKEN_CONTRACT_ID in .env from contract-register-token.mjs output.',
    );
  }

  const senderId = identity.id.toString();
  if (recipientId === senderId) {
    throw new Error('Cannot transfer tokens to yourself.');
  }

  const tokenId = await sdk.tokens.calculateId(dataContractId, tokenPosition);
  const balancesBefore = await sdk.tokens.identityBalances(recipientId, [
    tokenId,
  ]);

  console.log(
    `Recipient token balance before transfer: ${balancesBefore.get(tokenId) ?? 0n}`,
  );

  await sdk.tokens.transfer({
    dataContractId,
    tokenPosition,
    amount,
    senderId,
    recipientId,
    identityKey,
    signer,
  });

  const balancesAfter = await sdk.tokens.identityBalances(recipientId, [
    tokenId,
  ]);

  console.log(
    `Transferred ${amount} token${amount === 1n ? '' : 's'} from ${senderId} to ${recipientId}`,
  );
  console.log('Token ID:', tokenId);
  console.log(
    `Recipient token balance after transfer: ${balancesAfter.get(tokenId) ?? 0n}`,
  );
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
