import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import dotenv from 'dotenv';
import { EvoSDK } from '@dashevo/evo-sdk';
import { createClient } from '../setupDashClient-core.mjs';

dotenv.config();

// DPNS — a system contract, so it exists on every network and needs no fixture.
const DPNS_CONTRACT_ID = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec';

describe('Platform protocol version', () => {
  // Regression guard for #112: createClient() must leave the protocol version
  // unpinned so the SDK negotiates it. A hardcoded pin disables negotiation
  // silently — no error, no warning — and the client stays on the old version
  // forever once the network upgrades.
  for (const network of ['testnet', 'mainnet']) {
    it(`${network} negotiates the version instead of using a hardcoded pin`, async () => {
      const sdk = await createClient(network);

      // status() hands back a WASM handle — the fields are only reachable
      // through toJSON().
      const status = (await sdk.system.status()).toJSON();
      const networkVersion = Number(status.version.protocol.drive.current);
      const sdkNewestKnown = await EvoSDK.getLatestVersionNumber();

      // A proof-bearing read is what carries the network's version back to the
      // client; the negotiated value is only settled after the first one.
      await sdk.contracts.fetch(DPNS_CONTRACT_ID);

      // The client should land on the network's active version, except when the
      // network has moved past what this SDK release understands — then it stays
      // at its own ceiling. Asserting against the min() of the two keeps this
      // test honest without turning every network upgrade into a red build.
      assert.equal(
        sdk.version(),
        Math.min(networkVersion, sdkNewestKnown),
        `client settled on protocol version ${sdk.version()}, but ${network} ` +
          `is on ${networkVersion} and this SDK understands up to ` +
          `${sdkNewestKnown} — check for a reintroduced version pin`,
      );
    });
  }
});
