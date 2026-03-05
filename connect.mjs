import { EvoSDK } from '@dashevo/evo-sdk';

try {
  const sdk = EvoSDK.testnetTrusted();
  await sdk.connect();
  const status = await sdk.system.status();
  console.log('Connected. System status:\n', status.toJSON());
} catch (e) {
  console.error('Failed to fetch system status:', e.message);
}
