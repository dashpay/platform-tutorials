// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/tokens/retrieve-token-info.html
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, keyManager } = await setupDashClient();

// TOKEN_CONTRACT_ID comes from token-register.mjs.
const dataContractId = process.env.TOKEN_CONTRACT_ID;
const tokenPosition = 0;

// Default recipient (testnet). Replace or override via RECIPIENT_ID.
const recipientId =
  process.env.RECIPIENT_ID || '7XcruVSsGQVSgTcmPewaE4tXLutnW1F6PXxwMbo8GYQC';

try {
  if (!dataContractId) {
    throw new Error(
      'Set TOKEN_CONTRACT_ID in .env from token-register.mjs output.',
    );
  }

  const tokenId = await sdk.tokens.calculateId(dataContractId, tokenPosition);
  const contractInfo = await sdk.tokens.contractInfo(tokenId);
  const totalSupply = await sdk.tokens.totalSupply(tokenId);
  const statuses = await sdk.tokens.statuses([tokenId]);
  const identity = await sdk.identities.fetch(keyManager.identityId);
  const identityBalances = await sdk.tokens.identityBalances(identity.id, [
    tokenId,
  ]);
  const recipientBalances = await sdk.tokens.identityBalances(recipientId, [
    tokenId,
  ]);

  // A token only has a status record once one is published on-chain (e.g. via
  // an emergency pause), so the Map is empty for a freshly registered token.
  const status = statuses.get(tokenId);

  console.log('Token ID:', tokenId);
  console.log('Token contract info:\n', contractInfo?.toJSON());
  console.log(
    'Token status:',
    status ? status.isPaused : '(no status published)',
  );
  console.log('Total token supply:', totalSupply?.totalSupply ?? 0n);
  console.log(`Identity token balance: ${identityBalances.get(tokenId) ?? 0n}`);
  console.log(
    `Recipient token balance: ${recipientBalances.get(tokenId) ?? 0n}`,
  );
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
