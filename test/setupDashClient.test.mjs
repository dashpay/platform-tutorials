import { expect } from 'chai';
import dotenv from 'dotenv';
import {
  Identity,
  IdentityPublicKeyInCreation,
  IdentitySigner,
  PlatformAddressSigner,
  PrivateKey,
  wallet,
} from '@dashevo/evo-sdk';
import {
  IdentityKeyManager,
  AddressKeyManager,
  createClient,
  setupDashClient,
  clientConfig,
  dip13KeyPath,
} from '../setupDashClient.mjs';

dotenv.config();
const network = process.env.NETWORK || 'testnet';

// Testnet identity used by the tutorials (known to exist on-chain)
const IDENTITY_ID = 'GgZekwh38XcWQTyWWWvmw6CEYFnLU7yiZFPWZEjqKHit';

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon ' +
  'abandon abandon abandon abandon abandon about';

/**
 * Derive identity authentication keys from a BIP39 mnemonic using DIP-9 paths.
 * Inlined here since setupDashClient.mjs doesn't export this as a standalone function.
 */
async function deriveKeysFromMnemonic(
  mnemonic,
  net = 'testnet',
  identityIndex = 0,
  keyCount = 5,
) {
  const keys = [];

  for (let keyIndex = 0; keyIndex < keyCount; keyIndex++) {
    const path = await dip13KeyPath(net, identityIndex, keyIndex);
    const keyInfo = await wallet.deriveKeyFromSeedWithPath({
      mnemonic,
      path,
      network: net,
    });
    keys.push({ keyIndex, path, ...keyInfo.toObject() });
  }

  return keys;
}

/**
 * Build a fake SDK whose identities.byPublicKeyHash() returns truthy for
 * the given occupied identity indices and null for everything else.
 * Used by findNextIndex() and createForNewIdentity() stubbed tests.
 */
async function fakeSdkWithOccupiedIndices(occupiedIndices) {
  const occupiedHashes = new Set();
  for (const i of occupiedIndices) {
    const keys = await deriveKeysFromMnemonic(TEST_MNEMONIC, 'testnet', i, 1);
    const pk = PrivateKey.fromWIF(keys[0].privateKeyWif);
    occupiedHashes.add(Buffer.from(pk.getPublicKeyHash()).toString('hex'));
  }
  return {
    identities: {
      byPublicKeyHash: async (hash) => {
        const hex = Buffer.from(hash).toString('hex');
        return occupiedHashes.has(hex) ? { id: 'fake' } : null;
      },
    },
  };
}

describe('IdentityKeyManager', function suite() {
  this.timeout(30000);

  let sdk;

  before(async function () {
    sdk = await createClient(network);
  });

  describe('create()', function () {
    it('should derive deterministic keys from mnemonic', async function () {
      const km = await IdentityKeyManager.create({
        sdk,
        identityId: IDENTITY_ID,
        mnemonic: TEST_MNEMONIC,
        network: 'testnet',
        identityIndex: 0,
      });

      expect(km.identityId).to.equal(IDENTITY_ID);
      expect(km.keys.master).to.have.property('keyId', 0);
      expect(km.keys.master)
        .to.have.property('privateKeyWif')
        .that.is.a('string');
      expect(km.keys.authHigh).to.have.property('keyId', 1);
      expect(km.keys.authHigh)
        .to.have.property('privateKeyWif')
        .that.is.a('string');
      expect(km.keys.auth).to.have.property('keyId', 2);
      expect(km.keys.auth)
        .to.have.property('privateKeyWif')
        .that.is.a('string');
      expect(km.keys.transfer).to.have.property('keyId', 3);
      expect(km.keys.transfer)
        .to.have.property('privateKeyWif')
        .that.is.a('string');
      expect(km.keys.encryption).to.have.property('keyId', 4);
      expect(km.keys.encryption)
        .to.have.property('privateKeyWif')
        .that.is.a('string');
    });

    it('should produce same keys as deriveKeysFromMnemonic', async function () {
      const km = await IdentityKeyManager.create({
        sdk,
        identityId: IDENTITY_ID,
        mnemonic: TEST_MNEMONIC,
        network: 'testnet',
        identityIndex: 0,
      });
      const rawKeys = await deriveKeysFromMnemonic(
        TEST_MNEMONIC,
        'testnet',
        0,
        5,
      );

      expect(km.keys.master.privateKeyWif).to.equal(rawKeys[0].privateKeyWif);
      expect(km.keys.authHigh.privateKeyWif).to.equal(rawKeys[1].privateKeyWif);
      expect(km.keys.auth.privateKeyWif).to.equal(rawKeys[2].privateKeyWif);
      expect(km.keys.transfer.privateKeyWif).to.equal(rawKeys[3].privateKeyWif);
      expect(km.keys.encryption.privateKeyWif).to.equal(
        rawKeys[4].privateKeyWif,
      );
    });

    it('should auto-resolve identityId from mnemonic when not provided', async function () {
      if (!process.env.PLATFORM_MNEMONIC) {
        this.skip('PLATFORM_MNEMONIC not set');
      }
      const km = await IdentityKeyManager.create({
        sdk,
        mnemonic: process.env.PLATFORM_MNEMONIC,
        network,
      });
      expect(km.identityId).to.be.a('string').with.length.greaterThan(0);
      this.test.title += ` (${km.identityId})`;

      const { identity, identityKey, signer } = await km.getAuth();
      expect(identity).to.be.an.instanceOf(Identity);
      expect(identityKey).to.be.an('object');
      expect(signer).to.be.an.instanceOf(IdentitySigner);
    });

    it('should match explicit identityId when auto-resolved', async function () {
      if (!process.env.PLATFORM_MNEMONIC) {
        this.skip('PLATFORM_MNEMONIC not set');
      }
      const auto = await IdentityKeyManager.create({
        sdk,
        mnemonic: process.env.PLATFORM_MNEMONIC,
        network,
      });
      const explicit = await IdentityKeyManager.create({
        sdk,
        identityId: auto.identityId,
        mnemonic: process.env.PLATFORM_MNEMONIC,
        network,
      });
      expect(auto.identityId).to.equal(explicit.identityId);
      expect(auto.keys.master.privateKeyWif).to.equal(
        explicit.keys.master.privateKeyWif,
      );
      expect(auto.keys.auth.privateKeyWif).to.equal(
        explicit.keys.auth.privateKeyWif,
      );
    });

    it('should be deterministic (same inputs = same keys)', async function () {
      const km1 = await IdentityKeyManager.create({
        sdk,
        identityId: IDENTITY_ID,
        mnemonic: TEST_MNEMONIC,
      });
      const km2 = await IdentityKeyManager.create({
        sdk,
        identityId: IDENTITY_ID,
        mnemonic: TEST_MNEMONIC,
      });

      expect(km1.keys.auth.privateKeyWif).to.equal(km2.keys.auth.privateKeyWif);
      expect(km1.keys.master.privateKeyWif).to.equal(
        km2.keys.master.privateKeyWif,
      );
      expect(km1.keys.authHigh.privateKeyWif).to.equal(
        km2.keys.authHigh.privateKeyWif,
      );
      expect(km1.keys.transfer.privateKeyWif).to.equal(
        km2.keys.transfer.privateKeyWif,
      );
      expect(km1.keys.encryption.privateKeyWif).to.equal(
        km2.keys.encryption.privateKeyWif,
      );
    });
  });

  describe('getAuth()', function () {
    it('should return identity, identityKey, and signer', async function () {
      const km = await IdentityKeyManager.create({
        sdk,
        identityId: IDENTITY_ID,
        mnemonic: TEST_MNEMONIC,
      });
      const result = await km.getAuth();

      expect(result)
        .to.have.property('identity')
        .that.is.an.instanceOf(Identity);
      expect(result).to.have.property('identityKey').that.is.an('object');
      expect(result)
        .to.have.property('signer')
        .that.is.an.instanceOf(IdentitySigner);
      expect(result.identityKey.keyId).to.equal(2);
    });
  });

  describe('getAuthHigh()', function () {
    it('should return identity, identityKey, and signer', async function () {
      const km = await IdentityKeyManager.create({
        sdk,
        identityId: IDENTITY_ID,
        mnemonic: TEST_MNEMONIC,
      });
      const result = await km.getAuthHigh();

      expect(result)
        .to.have.property('identity')
        .that.is.an.instanceOf(Identity);
      expect(result).to.have.property('identityKey').that.is.an('object');
      expect(result)
        .to.have.property('signer')
        .that.is.an.instanceOf(IdentitySigner);
      expect(result.identityKey.keyId).to.equal(1);
    });
  });

  describe('getTransfer()', function () {
    it('should return identity, identityKey, and signer', async function () {
      const km = await IdentityKeyManager.create({
        sdk,
        identityId: IDENTITY_ID,
        mnemonic: TEST_MNEMONIC,
      });
      const result = await km.getTransfer();

      expect(result)
        .to.have.property('identity')
        .that.is.an.instanceOf(Identity);
      expect(result).to.have.property('identityKey').that.is.an('object');
      expect(result)
        .to.have.property('signer')
        .that.is.an.instanceOf(IdentitySigner);
      expect(result.identityKey.keyId).to.equal(3);
    });
  });

  describe('getEncryption()', function () {
    it('should return identity, identityKey, and signer', async function () {
      const km = await IdentityKeyManager.create({
        sdk,
        identityId: IDENTITY_ID,
        mnemonic: TEST_MNEMONIC,
      });
      const result = await km.getEncryption();

      expect(result)
        .to.have.property('identity')
        .that.is.an.instanceOf(Identity);
      expect(result).to.have.property('identityKey').that.is.an('object');
      expect(result)
        .to.have.property('signer')
        .that.is.an.instanceOf(IdentitySigner);
      expect(result.identityKey.keyId).to.equal(4);
    });
  });

  describe('getMaster()', function () {
    it('should return identity, identityKey, and signer', async function () {
      const km = await IdentityKeyManager.create({
        sdk,
        identityId: IDENTITY_ID,
        mnemonic: TEST_MNEMONIC,
      });
      const result = await km.getMaster();

      expect(result)
        .to.have.property('identity')
        .that.is.an.instanceOf(Identity);
      expect(result).to.have.property('identityKey').that.is.an('object');
      expect(result)
        .to.have.property('signer')
        .that.is.an.instanceOf(IdentitySigner);
      expect(result.signer.keyCount).to.equal(1);
      expect(result.identityKey.keyId).to.equal(0);
    });

    it('should add additional key WIFs to the signer', async function () {
      const km = await IdentityKeyManager.create({
        sdk,
        identityId: IDENTITY_ID,
        mnemonic: TEST_MNEMONIC,
      });
      // Derive an extra key to use as the additional WIF
      const extraKeys = await deriveKeysFromMnemonic(
        TEST_MNEMONIC,
        'testnet',
        1,
        1,
      );
      const extraWif = extraKeys[0].privateKeyWif;

      const result = await km.getMaster([extraWif]);
      expect(result.signer).to.be.an.instanceOf(IdentitySigner);
      expect(result.signer.keyCount).to.equal(2);
      expect(result.identityKey.keyId).to.equal(0);
    });
  });

  describe('identityIndex', function () {
    it('should store the provided identityIndex', async function () {
      const km = await IdentityKeyManager.create({
        sdk,
        identityId: IDENTITY_ID,
        mnemonic: TEST_MNEMONIC,
        identityIndex: 3,
      });
      expect(km.identityIndex).to.equal(3);
    });

    it('should default identityIndex to 0', async function () {
      const km = await IdentityKeyManager.create({
        sdk,
        identityId: IDENTITY_ID,
        mnemonic: TEST_MNEMONIC,
      });
      expect(km.identityIndex).to.equal(0);
    });
  });

  describe('getFullSigner()', function () {
    it('should return an IdentitySigner with all keys', async function () {
      const km = await IdentityKeyManager.create({
        sdk,
        identityId: IDENTITY_ID,
        mnemonic: TEST_MNEMONIC,
      });
      const signer = km.getFullSigner();
      expect(signer).to.be.an.instanceOf(IdentitySigner);
      expect(signer.keyCount).to.equal(5);
    });
  });

  describe('getKeysInCreation()', function () {
    it('should throw when public keys are not available', async function () {
      const km = await IdentityKeyManager.create({
        sdk,
        identityId: IDENTITY_ID,
        mnemonic: TEST_MNEMONIC,
      });
      expect(() => km.getKeysInCreation()).to.throw(
        'Public key data not available',
      );
    });

    it('should return 5 IdentityPublicKeyInCreation when public keys present', async function () {
      // Construct a manager with publicKey fields (as createForNewIdentity does)
      const base = await IdentityKeyManager.create({
        sdk,
        identityId: IDENTITY_ID,
        mnemonic: TEST_MNEMONIC,
      });
      const withPub = (entry) => {
        const pk = PrivateKey.fromWIF(entry.privateKeyWif);
        const publicKey = Buffer.from(pk.getPublicKey().toBytes()).toString(
          'hex',
        );
        return { ...entry, publicKey };
      };
      const km = new IdentityKeyManager(
        sdk,
        null,
        {
          master: withPub(base.keys.master),
          authHigh: withPub(base.keys.authHigh),
          auth: withPub(base.keys.auth),
          transfer: withPub(base.keys.transfer),
          encryption: withPub(base.keys.encryption),
        },
        0,
      );

      const keys = km.getKeysInCreation();
      expect(keys).to.be.an('array').with.length(5);
      keys.forEach((k) => {
        expect(k).to.be.an.instanceOf(IdentityPublicKeyInCreation);
      });
    });
  });

  describe('getSigner() guard', function () {
    it('should throw when identity ID is not set', async function () {
      const km = new IdentityKeyManager(
        sdk,
        null,
        {
          auth: { keyId: 2, privateKeyWif: 'placeholder' },
        },
        0,
      );
      try {
        await km.getAuth();
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('Identity ID is not set');
      }
    });

    it('should throw for invalid key name', async function () {
      const km = await IdentityKeyManager.create({
        sdk,
        identityId: IDENTITY_ID,
        mnemonic: TEST_MNEMONIC,
      });
      try {
        await km.getSigner('bogus');
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('Unknown key "bogus"');
      }
    });
  });

  describe('create() error paths', function () {
    it('should throw when mnemonic has no on-chain identity', async function () {
      try {
        await IdentityKeyManager.create({
          sdk,
          mnemonic: TEST_MNEMONIC,
          // no identityId — forces auto-resolve, which will fail
        });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('No identity found');
      }
    });

    it('should produce different keys for different identityIndex', async function () {
      const km0 = await IdentityKeyManager.create({
        sdk,
        identityId: IDENTITY_ID,
        mnemonic: TEST_MNEMONIC,
        identityIndex: 0,
      });
      const km1 = await IdentityKeyManager.create({
        sdk,
        identityId: IDENTITY_ID,
        mnemonic: TEST_MNEMONIC,
        identityIndex: 1,
      });
      expect(km0.keys.auth.privateKeyWif).to.not.equal(
        km1.keys.auth.privateKeyWif,
      );
    });
  });

  describe('createForNewIdentity()', function () {
    it('should return manager with null id and publicKey fields', async function () {
      const km = await IdentityKeyManager.createForNewIdentity({
        sdk,
        mnemonic: TEST_MNEMONIC,
        identityIndex: 99, // high index to avoid collision
      });
      expect(km.identityId).to.be.null;
      expect(km.identityIndex).to.equal(99);
      // All keys should have publicKey fields
      Object.values(km.keys).forEach((key) => {
        expect(key).to.have.property('publicKey').that.is.a('string');
        expect(key).to.have.property('privateKeyWif').that.is.a('string');
      });
    });

    it('should auto-scan to a nonzero index when earlier indices are occupied', async function () {
      const fakeSdk = await fakeSdkWithOccupiedIndices([0, 1]);
      const km = await IdentityKeyManager.createForNewIdentity({
        sdk: fakeSdk,
        mnemonic: TEST_MNEMONIC,
      });
      expect(km.identityIndex).to.equal(2);
      expect(km.identityId).to.be.null;
      Object.values(km.keys).forEach((key) => {
        expect(key).to.have.property('publicKey').that.is.a('string');
      });
    });
  });

  describe('findNextIndex()', function () {
    it('should return 0 for mnemonic with no on-chain identity', async function () {
      const idx = await IdentityKeyManager.findNextIndex(sdk, TEST_MNEMONIC);
      expect(idx).to.equal(0);
    });

    it('should skip occupied indices and return first unused', async function () {
      const fakeSdk = await fakeSdkWithOccupiedIndices([0, 1]);
      const idx = await IdentityKeyManager.findNextIndex(
        fakeSdk,
        TEST_MNEMONIC,
      );
      expect(idx).to.equal(2);
    });
  });
});

describe('AddressKeyManager', function suite() {
  this.timeout(30000);

  let sdk;
  let akm;

  before(async function () {
    sdk = await createClient(network);
    akm = await AddressKeyManager.create({
      sdk,
      mnemonic: TEST_MNEMONIC,
      network: 'testnet',
      count: 2,
    });
  });

  describe('create()', function () {
    it('should derive addresses from mnemonic', function () {
      expect(akm.network).to.equal('testnet');
      expect(akm.addresses).to.have.length(2);
      akm.addresses.forEach((addr) => {
        expect(addr).to.have.property('address');
        expect(addr).to.have.property('bech32m').that.is.a('string');
        expect(addr.bech32m).to.match(/^tdash1/);
        expect(addr).to.have.property('privateKeyWif').that.is.a('string');
        expect(addr).to.have.property('path').that.is.a('string');
      });
    });

    it('should be deterministic (same inputs = same addresses)', async function () {
      const akm2 = await AddressKeyManager.create({
        sdk,
        mnemonic: TEST_MNEMONIC,
        network: 'testnet',
        count: 2,
      });
      expect(akm.addresses[0].bech32m).to.equal(akm2.addresses[0].bech32m);
      expect(akm.addresses[1].bech32m).to.equal(akm2.addresses[1].bech32m);
    });

    it('should default to count=1', async function () {
      const single = await AddressKeyManager.create({
        sdk,
        mnemonic: TEST_MNEMONIC,
        network: 'testnet',
      });
      expect(single.addresses).to.have.length(1);
    });
  });

  describe('primaryAddress', function () {
    it('should return the first derived address', function () {
      expect(akm.primaryAddress).to.equal(akm.addresses[0]);
      expect(akm.primaryAddress)
        .to.have.property('bech32m')
        .that.is.a('string');
    });
  });

  describe('getSigner()', function () {
    it('should return a PlatformAddressSigner', function () {
      const signer = akm.getSigner();
      expect(signer).to.be.an.instanceOf(PlatformAddressSigner);
    });
  });

  describe('getFullSigner()', function () {
    it('should return a PlatformAddressSigner with all keys', function () {
      const signer = akm.getFullSigner();
      expect(signer).to.be.an.instanceOf(PlatformAddressSigner);
    });
  });

  describe('getInfo()', function () {
    it('should fetch primary address info', async function () {
      if (!process.env.PLATFORM_MNEMONIC) {
        this.skip('PLATFORM_MNEMONIC not set (address may not be funded)');
      }
      const funded = await AddressKeyManager.create({
        sdk,
        mnemonic: process.env.PLATFORM_MNEMONIC,
        network,
      });
      const info = await funded.getInfo();
      // Address may or may not be funded — just verify no crash
      // If funded, info is an object; if not, undefined
      if (info) {
        expect(info).to.be.an('object');
      }
    });

    it('should query the primary address bech32m', async function () {
      const fakeInfo = { balance: 500, nonce: 0 };
      let queriedAddress;
      const fakeSdk = {
        addresses: {
          get: async (addr) => {
            queriedAddress = addr;
            return fakeInfo;
          },
        },
      };
      const mgr = new AddressKeyManager(
        fakeSdk,
        [{ bech32m: 'tdash1primary' }],
        'testnet',
      );
      const info = await mgr.getInfo();
      expect(queriedAddress).to.equal('tdash1primary');
      expect(info).to.deep.equal(fakeInfo);
    });
  });

  describe('getInfoAt()', function () {
    it('should throw for out-of-range index', async function () {
      const empty = new AddressKeyManager(null, [], 'testnet');
      try {
        await empty.getInfoAt(0);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('No derived address at index 0');
      }
    });

    it('should query the correct address for a valid index', async function () {
      const fakeInfo = { balance: 1000, nonce: 1 };
      let queriedAddress;
      const fakeSdk = {
        addresses: {
          get: async (addr) => {
            queriedAddress = addr;
            return fakeInfo;
          },
        },
      };
      const mgr = new AddressKeyManager(
        fakeSdk,
        [{ bech32m: 'tdash1aaa' }, { bech32m: 'tdash1bbb' }],
        'testnet',
      );
      const info = await mgr.getInfoAt(1);
      expect(queriedAddress).to.equal('tdash1bbb');
      expect(info).to.deep.equal(fakeInfo);
    });
  });
});

describe('createClient()', function () {
  this.timeout(30000);

  it('should throw for unknown network', async function () {
    try {
      await createClient('bogus');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err.message).to.include('Unknown network "bogus"');
    }
  });

  it('should connect to testnet', async function () {
    const sdk = await createClient('testnet');
    expect(sdk.isConnected).to.be.true;
  });

  it('should connect to mainnet', async function () {
    const sdk = await createClient('mainnet');
    expect(sdk.isConnected).to.be.true;
  });
});

describe('setupDashClient()', function () {
  this.timeout(30000);

  it('should return sdk, keyManager, and addressKeyManager', async function () {
    if (!process.env.PLATFORM_MNEMONIC) {
      this.skip('PLATFORM_MNEMONIC not set');
    }
    const result = await setupDashClient();
    expect(result).to.have.property('sdk');
    expect(result)
      .to.have.property('keyManager')
      .that.is.an.instanceOf(IdentityKeyManager);
    expect(result)
      .to.have.property('addressKeyManager')
      .that.is.an.instanceOf(AddressKeyManager);
    expect(result.keyManager.identityId)
      .to.be.a('string')
      .with.length.greaterThan(0);
    expect(result.addressKeyManager.network).to.equal(clientConfig.network);
  });

  it('should reject an invalid mnemonic before attempting key derivation', async function () {
    const saved = clientConfig.mnemonic;
    try {
      clientConfig.mnemonic = 'not a valid mnemonic phrase at all';
      try {
        await setupDashClient();
        expect.fail('should have thrown');
      } catch (err) {
        // Without early validation, an invalid mnemonic reaches the WASM SDK
        // which throws a raw WasmSdkError (no .message, not an Error instance).
        // The fix catches it up front with a standard Error and helpful message.
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.be.a('string');
        expect(err.message).to.include('mnemonic');
      }
    } finally {
      clientConfig.mnemonic = saved;
    }
  });

  it('should return undefined managers when no mnemonic configured', async function () {
    const saved = clientConfig.mnemonic;
    try {
      clientConfig.mnemonic = null;
      const result = await setupDashClient();
      expect(result).to.have.property('sdk');
      expect(result.keyManager).to.be.undefined;
      expect(result.addressKeyManager).to.be.undefined;
    } finally {
      clientConfig.mnemonic = saved;
    }
  });

  it.skip('should not produce a TypeError when write tutorials use keyManager without a mnemonic', async function () {
    // Write tutorials do: const { keyManager } = await setupDashClient();
    //                      const { signer } = await keyManager.getAuth();
    // Without a mnemonic, keyManager is undefined → TypeError on .getAuth().
    // This test verifies the failure is a clear Error, not a raw TypeError.
    const saved = clientConfig.mnemonic;
    try {
      clientConfig.mnemonic = null;
      const { keyManager, addressKeyManager } = await setupDashClient();

      try {
        await keyManager.getAuth();
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.not.include(
          'Cannot read properties of undefined',
        );
      }

      try {
        addressKeyManager.getSigner();
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.not.include(
          'Cannot read properties of undefined',
        );
      }
    } finally {
      clientConfig.mnemonic = saved;
    }
  });

  it('should return undefined managers with requireIdentity: false and no mnemonic', async function () {
    // #2: requireIdentity: false still skips key derivation when no mnemonic is set
    const saved = clientConfig.mnemonic;
    try {
      clientConfig.mnemonic = null;
      const result = await setupDashClient({ requireIdentity: false });
      expect(result).to.have.property('sdk');
      expect(result.keyManager).to.be.undefined;
      expect(result.addressKeyManager).to.be.undefined;
    } finally {
      clientConfig.mnemonic = saved;
    }
  });

  it('should throw when mnemonic has no registered identity and requireIdentity is true', async function () {
    // #7: Valid mnemonic but no identity registered on-chain — the default
    // requireIdentity: true path tries to auto-resolve and fails.
    const saved = clientConfig.mnemonic;
    try {
      clientConfig.mnemonic = TEST_MNEMONIC;
      try {
        await setupDashClient(); // requireIdentity defaults to true
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.include('No identity found');
      }
    } finally {
      clientConfig.mnemonic = saved;
    }
  });

  it('should pass identityIndex through to IdentityKeyManager.create()', async function () {
    // Verifies identityIndex is forwarded through setupDashClient
    // (uses requireIdentity: false to avoid identity lookup).
    const saved = clientConfig.mnemonic;
    try {
      clientConfig.mnemonic = TEST_MNEMONIC;
      // Both will fail with "No identity found" since TEST_MNEMONIC has no
      // on-chain identity, but they fail at different derivation paths,
      // proving identityIndex is forwarded. We just need it not to crash
      // before reaching the identity lookup.
      // Use requireIdentity: false to avoid the lookup and verify the index is stored.
      const r0 = await setupDashClient({
        requireIdentity: false,
        identityIndex: 0,
      });
      const r1 = await setupDashClient({
        requireIdentity: false,
        identityIndex: 1,
      });
      expect(r0.keyManager.identityIndex).to.equal(0);
      expect(r1.keyManager.identityIndex).to.equal(1);
      // Different indices must produce different keys
      expect(r0.keyManager.keys.master.privateKeyWif).to.not.equal(
        r1.keyManager.keys.master.privateKeyWif,
      );
    } finally {
      clientConfig.mnemonic = saved;
    }
  });

  it('should pass explicit identityIndex through with requireIdentity: false', async function () {
    // #10: createForNewIdentity with explicit identityIndex — skips findNextIndex scan
    const saved = clientConfig.mnemonic;
    try {
      clientConfig.mnemonic = TEST_MNEMONIC;
      const result = await setupDashClient({
        requireIdentity: false,
        identityIndex: 42,
      });
      expect(result.keyManager).to.be.an.instanceOf(IdentityKeyManager);
      expect(result.keyManager.identityIndex).to.equal(42);
      expect(result.keyManager.identityId).to.be.null;
      // All keys should have publicKey fields (createForNewIdentity path)
      Object.values(result.keyManager.keys).forEach((key) => {
        expect(key).to.have.property('publicKey').that.is.a('string');
        expect(key).to.have.property('privateKeyWif').that.is.a('string');
      });
    } finally {
      clientConfig.mnemonic = saved;
    }
  });

  it('should not throw for a fresh mnemonic with requireIdentity: false', async function () {
    const saved = clientConfig.mnemonic;
    try {
      clientConfig.mnemonic = TEST_MNEMONIC;
      const result = await setupDashClient({ requireIdentity: false });
      expect(result).to.have.property('sdk');
      expect(result)
        .to.have.property('keyManager')
        .that.is.an.instanceOf(IdentityKeyManager);
      expect(result.keyManager.identityId).to.be.null;
      expect(result)
        .to.have.property('addressKeyManager')
        .that.is.an.instanceOf(AddressKeyManager);
    } finally {
      clientConfig.mnemonic = saved;
    }
  });

  it('requireIdentity: false should auto-scan to an unused identity index', async function () {
    if (!process.env.PLATFORM_MNEMONIC) {
      this.skip('PLATFORM_MNEMONIC not set');
    }
    const { keyManager } = await setupDashClient({ requireIdentity: false });
    // Must pick an index beyond all registered identities (not 0)
    expect(keyManager.identityIndex).to.be.a('number').greaterThan(0);
    expect(keyManager.identityId).to.be.null;
    this.test.title += ` (index ${keyManager.identityIndex})`;
  });
});

describe('IdentityKeyManager.createForNewIdentity() auto-index', function () {
  this.timeout(30000);

  it('should auto-select index 0 for unfunded mnemonic', async function () {
    const sdk = await createClient(network);
    const km = await IdentityKeyManager.createForNewIdentity({
      sdk,
      mnemonic: TEST_MNEMONIC,
      // no identityIndex — triggers findNextIndex
    });
    expect(km.identityIndex).to.equal(0);
    expect(km.identityId).to.be.null;
    Object.values(km.keys).forEach((key) => {
      expect(key).to.have.property('publicKey').that.is.a('string');
    });
  });
});

describe('dip13KeyPath()', function () {
  it('should build a valid DIP-13 testnet path', async function () {
    const path = await dip13KeyPath('testnet', 0, 0);
    // m/9'/{coin}'/5'/0'/0'/{identityIndex}'/{keyIndex}'
    expect(path).to.equal("m/9'/1'/5'/0'/0'/0'/0'");
  });

  it('should vary by identityIndex and keyIndex', async function () {
    const p00 = await dip13KeyPath('testnet', 0, 0);
    const p01 = await dip13KeyPath('testnet', 0, 1);
    const p10 = await dip13KeyPath('testnet', 1, 0);
    expect(p00).to.not.equal(p01);
    expect(p00).to.not.equal(p10);
    expect(p01).to.equal("m/9'/1'/5'/0'/0'/0'/1'");
    expect(p10).to.equal("m/9'/1'/5'/0'/0'/1'/0'");
  });

  it('should use coin type 5 for mainnet', async function () {
    const path = await dip13KeyPath('mainnet', 0, 0);
    expect(path).to.equal("m/9'/5'/5'/0'/0'/0'/0'");
  });
});
