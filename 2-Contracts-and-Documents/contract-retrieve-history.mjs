import { setupDashClient } from '../setupDashClient.mjs';

const { sdk } = await setupDashClient();

// Default tutorial contract with history (testnet). Replace or override via DATA_CONTRACT_ID.
const DATA_CONTRACT_ID =
  process.env.DATA_CONTRACT_ID ??
  '5J4VPym1Bnc2Ap9bbo9wNw6fZLGsCzDM7ZScdzcggN1r';

try {
  const history = await sdk.contracts.getHistory({
    dataContractId: DATA_CONTRACT_ID,
  });

  for (const [timestamp, contract] of history) {
    console.log(`Version at ${timestamp}:`, contract.toJSON());
  }
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}
