/* eslint-disable no-console */
import setupEvoClient from './setupEvoClient.mjs';

(async () => {
  // Create SDK instance using setupEvoClient
  const sdk = setupEvoClient();

  // Connect to the network
  await sdk.connect();

  console.log('SDK Version:', sdk.version());
  console.log('Connected:', sdk.isConnected);

  // Get identity data only
  console.log('\nFetching identity (data only)...');
  let result = await sdk.identities.fetch('7XcruVSsGQVSgTcmPewaE4tXLutnW1F6PXxwMbo8GYQC');
  console.log(result.toJSON());

  // Get identity with proof
  console.log('\nFetching identity (with proof)...');
  result = await sdk.identities.fetchWithProof('7XcruVSsGQVSgTcmPewaE4tXLutnW1F6PXxwMbo8GYQC');
  console.log(result);
})();
