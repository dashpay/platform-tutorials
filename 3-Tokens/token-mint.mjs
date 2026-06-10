// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/tokens/mint-tokens.html
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk, keyManager } = await setupDashClient();
const { identity, identityKey, signer } = await keyManager.getAuth();

// TOKEN_CONTRACT_ID comes from token-register.mjs.
const dataContractId = process.env.TOKEN_CONTRACT_ID;
const tokenPosition = 0;
const amount = 10n; // Token amounts are bigint values

try {
  if (!dataContractId) {
    throw new Error(
      'Set TOKEN_CONTRACT_ID in .env from token-register.mjs output.',
    );
  }

  const tokenId = await sdk.tokens.calculateId(dataContractId, tokenPosition);

  await sdk.tokens.mint({
    dataContractId,
    tokenPosition,
    amount,
    identityId: identity.id.toString(),
    identityKey,
    signer,
  });

  const balances = await sdk.tokens.identityBalances(identity.id, [tokenId]);
  const totalSupply = await sdk.tokens.totalSupply(tokenId);

  console.log(`Minted ${amount} tokens`);
  console.log('Token ID:', tokenId);
  console.log(`Identity token balance: ${balances.get(tokenId) ?? 0n}`);
  console.log('Total token supply:', totalSupply?.totalSupply ?? 0n);
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
