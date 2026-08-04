import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EvoSDK } from '@dashevo/evo-sdk';
import { createClient } from '../setupDashClient-core.mjs';

const trustedFactories = [
  ['testnet', 'testnetTrusted'],
  ['mainnet', 'mainnetTrusted'],
  ['local', 'localTrusted'],
];

describe('Platform protocol version configuration', () => {
  for (const [network, factoryName] of trustedFactories) {
    it(`${network} leaves the SDK version unpinned`, async (t) => {
      const sdk = { connect: t.mock.fn(async () => {}) };
      const factory = t.mock.method(EvoSDK, factoryName, () => sdk);

      assert.equal(await createClient(network), sdk);
      assert.equal(factory.mock.callCount(), 1);
      assert.deepEqual(factory.mock.calls[0].arguments, []);
      assert.equal(sdk.connect.mock.callCount(), 1);
    });
  }
});
