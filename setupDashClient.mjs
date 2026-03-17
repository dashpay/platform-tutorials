/* eslint-disable max-classes-per-file */
import {
  EvoSDK,
  IdentityPublicKeyInCreation,
  IdentitySigner,
  KeyType,
  PlatformAddressSigner,
  PrivateKey,
  Purpose,
  SecurityLevel,
  wallet,
} from '@dashevo/evo-sdk';

// Load .env if dotenv is installed (optional — not needed for tutorials).
// Top-level await requires ESM — .mjs extension ensures this.
// eslint-disable-next-line import/no-extraneous-dependencies
try {
  const { config } = await import('dotenv');
  config();
} catch {
  /* dotenv not installed */
}

// ⚠️ Tutorial helper — holds WIFs in memory for convenience.
// Do not use this pattern as-is for production key management.

// ###########################################################################
// #  CONFIGURATION — edit these values for your environment               #
// ###########################################################################
// Option 1: Edit the values below directly
// Option 2: Create a .env file with PLATFORM_MNEMONIC and NETWORK

const clientConfig = {
  // The network to connect to ('testnet' or 'mainnet')
  network: process.env.NETWORK || 'testnet',

  // BIP39 mnemonic for wallet operations (identity & address tutorials).
  // Leave as null for read-only tutorials.
  mnemonic: process.env.PLATFORM_MNEMONIC || null,
  // mnemonic: 'your twelve word mnemonic phrase goes here ...',
};

/**
 * Build a DIP-13 identity key derivation path.
 * Returns the full 7-level hardened path:
 *   m/9'/{coin}'/5'/0'/0'/{identityIndex}'/{keyIndex}'
 * @param {string} network
 * @param {number} identityIndex
 * @param {number} keyIndex
 */
export async function dip13KeyPath(network, identityIndex, keyIndex) {
  const base =
    network === 'testnet'
      ? await wallet.derivationPathDip13Testnet(5)
      : await wallet.derivationPathDip13Mainnet(5);
  return `${base.path}/0'/0'/${identityIndex}'/${keyIndex}'`;
}

// ---------------------------------------------------------------------------
// SDK client helpers
// ---------------------------------------------------------------------------

export async function createClient(network = 'testnet') {
  const factories = /** @type {Record<string, () => EvoSDK>} */ ({
    testnet: () => EvoSDK.testnetTrusted(),
    mainnet: () => EvoSDK.mainnetTrusted(),
    local: () => EvoSDK.localTrusted(),
  });

  const factory = factories[network];
  if (!factory) {
    throw new Error(
      `Unknown network "${network}". Use: ${Object.keys(factories).join(', ')}`,
    );
  }

  const sdk = /** @type {EvoSDK} */ (factory());
  await sdk.connect();
  return sdk;
}

// ---------------------------------------------------------------------------
// IdentityKeyManager
// ---------------------------------------------------------------------------

/** Key specs for the 5 standard identity keys (DIP-9). */
const KEY_SPECS = [
  {
    keyId: 0,
    purpose: Purpose.AUTHENTICATION,
    securityLevel: SecurityLevel.MASTER,
  },
  {
    keyId: 1,
    purpose: Purpose.AUTHENTICATION,
    securityLevel: SecurityLevel.HIGH,
  },
  {
    keyId: 2,
    purpose: Purpose.AUTHENTICATION,
    securityLevel: SecurityLevel.CRITICAL,
  },
  {
    keyId: 3,
    purpose: Purpose.TRANSFER,
    securityLevel: SecurityLevel.CRITICAL,
  },
  {
    keyId: 4,
    purpose: Purpose.ENCRYPTION,
    securityLevel: SecurityLevel.MEDIUM,
  },
];

/**
 * Manages identity keys and signing for write operations.
 *
 * Mirrors the old js-dash-sdk pattern where `setupDashClient()` hid all
 * wallet/signing config. Construct once, then call getAuth(), getTransfer(),
 * or getMaster() to get a ready-to-use { identity, identityKey, signer }.
 *
 * Keys are derived from a BIP39 mnemonic using standard DIP-9 paths
 * (compatible with dash-evo-tool / Dash wallets):
 *   Key 0 = MASTER (identity updates)
 *   Key 1 = HIGH auth (documents, names)
 *   Key 2 = CRITICAL auth (contracts, documents, names)
 *   Key 3 = TRANSFER (credit transfers/withdrawals)
 *   Key 4 = ENCRYPTION MEDIUM (encrypted messaging/data)
 */
class IdentityKeyManager {
  /**
   * @param {any} sdk
   * @param {string|null|undefined} identityId
   * @param {Record<string, any>} keys
   * @param {number} identityIndex
   */
  constructor(sdk, identityId, keys, identityIndex) {
    this.sdk = sdk;
    this.id = identityId;
    this.keys = keys; // { master, auth, authHigh, transfer, encryption }
    this.identityIndex = identityIndex ?? 0;
  }

  get identityId() {
    return this.id;
  }

  /**
   * Create an IdentityKeyManager from a BIP39 mnemonic.
   * Derives all standard identity keys using DIP-9 paths.
   *
   * @param {object} opts
   * @param {any} opts.sdk - Connected EvoSDK instance
   * @param {string} [opts.identityId] - Identity ID. If omitted, auto-resolved
   *   from the mnemonic by looking up the master key's public key hash on-chain.
   * @param {string} opts.mnemonic - BIP39 mnemonic
   * @param {string} [opts.network='testnet'] - 'testnet' or 'mainnet'
   * @param {number} [opts.identityIndex=0] - Which identity derived from this mnemonic
   */
  static async create({
    sdk,
    identityId,
    mnemonic,
    network = 'testnet',
    identityIndex = 0,
  }) {
    const derive = async (/** @type {number} */ keyIndex) =>
      wallet.deriveKeyFromSeedWithPath({
        mnemonic,
        path: await dip13KeyPath(network, identityIndex, keyIndex),
        network,
      });

    const [masterKey, authHighKey, authKey, transferKey, encryptionKey] =
      await Promise.all([
        derive(0), // MASTER
        derive(1), // HIGH auth
        derive(2), // CRITICAL auth
        derive(3), // TRANSFER
        derive(4), // ENCRYPTION MEDIUM
      ]);

    let resolvedId = identityId;
    if (!resolvedId) {
      const privateKey = PrivateKey.fromWIF(masterKey.toObject().privateKeyWif);
      const pubKeyHash = privateKey.getPublicKeyHash();
      const identity = await sdk.identities.byPublicKeyHash(pubKeyHash);
      if (!identity) {
        throw new Error(
          'No identity found for the given mnemonic (key 0 public key hash)',
        );
      }
      resolvedId = identity.id.toString();
    }

    return new IdentityKeyManager(
      sdk,
      resolvedId,
      {
        master: { keyId: 0, privateKeyWif: masterKey.toObject().privateKeyWif },
        authHigh: {
          keyId: 1,
          privateKeyWif: authHighKey.toObject().privateKeyWif,
        },
        auth: { keyId: 2, privateKeyWif: authKey.toObject().privateKeyWif },
        transfer: {
          keyId: 3,
          privateKeyWif: transferKey.toObject().privateKeyWif,
        },
        encryption: {
          keyId: 4,
          privateKeyWif: encryptionKey.toObject().privateKeyWif,
        },
      },
      identityIndex,
    );
  }

  /**
   * Find the first unused DIP-9 identity index for a mnemonic.
   * Scans indices starting at 0 until no on-chain identity is found.
   *
   * @param {any} sdk - Connected EvoSDK instance
   * @param {string} mnemonic - BIP39 mnemonic
   * @param {string} [network='testnet'] - 'testnet' or 'mainnet'
   * @returns {Promise<number>} The first unused identity index
   */
  static async findNextIndex(sdk, mnemonic, network = 'testnet') {
    /* eslint-disable no-await-in-loop */
    for (let i = 0; ; i += 1) {
      const path = await dip13KeyPath(network, i, 0);
      const key = await wallet.deriveKeyFromSeedWithPath({
        mnemonic,
        path,
        network,
      });
      const privateKey = PrivateKey.fromWIF(key.toObject().privateKeyWif);
      const existing = await sdk.identities.byPublicKeyHash(
        privateKey.getPublicKeyHash(),
      );
      if (!existing) return i;
    }
    /* eslint-enable no-await-in-loop */
  }

  /**
   * Create an IdentityKeyManager for a new (not yet registered) identity.
   * Derives keys and stores public key data needed for identity creation.
   * If identityIndex is omitted, auto-selects the next unused index.
   *
   * @param {object} opts
   * @param {any} opts.sdk - Connected EvoSDK instance
   * @param {string} opts.mnemonic - BIP39 mnemonic
   * @param {string} [opts.network='testnet'] - 'testnet' or 'mainnet'
   * @param {number} [opts.identityIndex] - Identity index (auto-scanned if omitted)
   * @returns {Promise<IdentityKeyManager>}
   */
  static async createForNewIdentity({
    sdk,
    mnemonic,
    network = 'testnet',
    identityIndex,
  }) {
    const idx =
      identityIndex ??
      (await IdentityKeyManager.findNextIndex(sdk, mnemonic, network));
    const derive = async (/** @type {number} */ keyIndex) =>
      wallet.deriveKeyFromSeedWithPath({
        mnemonic,
        path: await dip13KeyPath(network, idx, keyIndex),
        network,
      });

    const derivedKeys = await Promise.all(
      KEY_SPECS.map((spec) => derive(spec.keyId)),
    );

    const keys = {
      master: {
        keyId: 0,
        privateKeyWif: derivedKeys[0].toObject().privateKeyWif,
        publicKey: derivedKeys[0].toObject().publicKey,
      },
      authHigh: {
        keyId: 1,
        privateKeyWif: derivedKeys[1].toObject().privateKeyWif,
        publicKey: derivedKeys[1].toObject().publicKey,
      },
      auth: {
        keyId: 2,
        privateKeyWif: derivedKeys[2].toObject().privateKeyWif,
        publicKey: derivedKeys[2].toObject().publicKey,
      },
      transfer: {
        keyId: 3,
        privateKeyWif: derivedKeys[3].toObject().privateKeyWif,
        publicKey: derivedKeys[3].toObject().publicKey,
      },
      encryption: {
        keyId: 4,
        privateKeyWif: derivedKeys[4].toObject().privateKeyWif,
        publicKey: derivedKeys[4].toObject().publicKey,
      },
    };

    return new IdentityKeyManager(sdk, null, keys, idx);
  }

  /**
   * Build IdentityPublicKeyInCreation objects for all 5 standard keys.
   * Only works when public key data is available (via createForNewIdentity).
   *
   * @returns {IdentityPublicKeyInCreation[]}
   */
  getKeysInCreation() {
    return KEY_SPECS.map((spec) => {
      const key = Object.values(this.keys).find((k) => k.keyId === spec.keyId);
      if (!key?.publicKey) {
        throw new Error(
          `Public key data not available for key ${spec.keyId}. Use createForNewIdentity().`,
        );
      }
      const pubKeyData = Uint8Array.from(Buffer.from(key.publicKey, 'hex'));
      return new IdentityPublicKeyInCreation({
        keyId: spec.keyId,
        purpose: spec.purpose,
        securityLevel: spec.securityLevel,
        keyType: KeyType.ECDSA_SECP256K1,
        data: pubKeyData,
      });
    });
  }

  /**
   * Build an IdentitySigner loaded with all 5 key WIFs.
   * Useful for identity creation where all keys must sign.
   *
   * @returns {IdentitySigner}
   */
  getFullSigner() {
    const signer = new IdentitySigner();
    Object.values(this.keys).forEach((key) => {
      signer.addKeyFromWif(key.privateKeyWif);
    });
    return signer;
  }

  /**
   * Fetch identity and build { identity, identityKey, signer } for a given key.
   * @param {string} keyName - One of: master, auth, authHigh, transfer, encryption
   * @returns {Promise<{ identity: any, identityKey: any, signer: IdentitySigner }>}
   */
  async getSigner(keyName) {
    if (!this.id) {
      throw new Error(
        'Identity ID is not set. Use IdentityKeyManager.create() for an existing identity, ' +
          'or create/register the identity first and then set the ID.',
      );
    }
    const key = /** @type {Record<string, any>} */ (this.keys)[keyName];
    if (!key) {
      throw new Error(
        `Unknown key "${keyName}". Use: ${Object.keys(this.keys).join(', ')}`,
      );
    }
    const identity = await this.sdk.identities.fetch(this.id);
    const identityKey = identity.getPublicKeyById(key.keyId);
    const signer = new IdentitySigner();
    signer.addKeyFromWif(key.privateKeyWif);
    return { identity, identityKey, signer };
  }

  /** CRITICAL auth (key 2) — contracts, documents, names. */
  async getAuth() {
    return this.getSigner('auth');
  }

  /** HIGH auth (key 1) — documents, names. */
  async getAuthHigh() {
    return this.getSigner('authHigh');
  }

  /** TRANSFER — credit transfers, withdrawals. */
  async getTransfer() {
    return this.getSigner('transfer');
  }

  /** ENCRYPTION MEDIUM — encrypted messaging/data. */
  async getEncryption() {
    return this.getSigner('encryption');
  }

  /**
   * MASTER — identity updates (add/disable keys).
   * @param {string[]} [additionalKeyWifs] - WIFs for new keys being added
   */
  async getMaster(additionalKeyWifs) {
    const result = await this.getSigner('master');
    if (additionalKeyWifs) {
      additionalKeyWifs.forEach((wif) => result.signer.addKeyFromWif(wif));
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// AddressKeyManager
// ---------------------------------------------------------------------------

/**
 * Manages platform address keys and signing for address operations.
 *
 * Parallel to IdentityKeyManager but for platform address operations.
 * Derives BIP44 keys from a mnemonic and provides ready-to-use
 * PlatformAddressSigner instances.
 *
 * Platform addresses are bech32m-encoded L2 addresses (tdash1... on testnet)
 * that hold credits directly, independent of identities.
 */
class AddressKeyManager {
  /**
   * @param {any} sdk
   * @param {Array<{address: any, bech32m: string, privateKeyWif: string, path: string}>} addresses
   * @param {string} network
   */
  constructor(sdk, addresses, network) {
    this.sdk = sdk;
    this.addresses = addresses; // [{ address, bech32m, privateKeyWif, path }]
    this.network = network;
  }

  /** The first derived address (index 0). */
  get primaryAddress() {
    return this.addresses[0];
  }

  /**
   * Create an AddressKeyManager from a BIP39 mnemonic.
   * Derives platform address keys using BIP44 paths.
   *
   * @param {object} opts
   * @param {any} opts.sdk - Connected EvoSDK instance
   * @param {string} opts.mnemonic - BIP39 mnemonic
   * @param {string} [opts.network='testnet'] - 'testnet' or 'mainnet'
   * @param {number} [opts.count=1] - Number of addresses to derive
   */
  static async create({ sdk, mnemonic, network = 'testnet', count = 1 }) {
    const addresses = [];

    /* eslint-disable no-await-in-loop */
    for (let i = 0; i < count; i += 1) {
      const pathInfo =
        network === 'testnet'
          ? await wallet.derivationPathBip44Testnet(0, 0, i)
          : await wallet.derivationPathBip44Mainnet(0, 0, i);
      const { path } = pathInfo;
      const keyInfo = await wallet.deriveKeyFromSeedWithPath({
        mnemonic,
        path,
        network,
      });
      const obj = keyInfo.toObject();
      const privateKey = PrivateKey.fromWIF(obj.privateKeyWif);
      const signer = new PlatformAddressSigner();
      const platformAddress = signer.addKey(privateKey);

      addresses.push({
        address: platformAddress,
        bech32m: platformAddress.toBech32m(/** @type {any} */ (network)),
        privateKeyWif: obj.privateKeyWif,
        path,
      });
    }
    /* eslint-enable no-await-in-loop */

    return new AddressKeyManager(sdk, addresses, network);
  }

  /**
   * Create a PlatformAddressSigner with the primary key loaded.
   * @returns {PlatformAddressSigner}
   */
  getSigner() {
    const signer = new PlatformAddressSigner();
    const privateKey = PrivateKey.fromWIF(this.primaryAddress.privateKeyWif);
    signer.addKey(privateKey);
    return signer;
  }

  /**
   * Create a PlatformAddressSigner with all derived keys loaded.
   * @returns {PlatformAddressSigner}
   */
  getFullSigner() {
    const signer = new PlatformAddressSigner();
    this.addresses.forEach((/** @type {any} */ addr) => {
      const privateKey = PrivateKey.fromWIF(addr.privateKeyWif);
      signer.addKey(privateKey);
    });
    return signer;
  }

  /**
   * Fetch current balance and nonce for the primary address.
   * @returns {Promise<any>}
   */
  async getInfo() {
    return this.sdk.addresses.get(this.primaryAddress.bech32m);
  }

  /**
   * Fetch current balance and nonce for an address by index.
   * @param {number} index - Address index
   * @returns {Promise<any>}
   */
  async getInfoAt(index) {
    const entry = this.addresses[index];
    if (!entry) {
      throw new Error(
        `No derived address at index ${index} (count=${this.addresses.length})`,
      );
    }
    return this.sdk.addresses.get(entry.bech32m);
  }
}

// ---------------------------------------------------------------------------
// setupDashClient — convenience wrapper
// ---------------------------------------------------------------------------

/**
 * @returns {Promise<{ sdk: EvoSDK, keyManager: IdentityKeyManager, addressKeyManager: AddressKeyManager }>}
 */
export async function setupDashClient({
  requireIdentity = true,
  identityIndex = undefined,
} = {}) {
  const { network, mnemonic } = clientConfig;

  if (mnemonic && !(await wallet.validateMnemonic(mnemonic))) {
    throw new Error(
      'PLATFORM_MNEMONIC is not a valid BIP39 mnemonic. ' +
        'Run `node create-wallet.mjs` to generate one.',
    );
  }

  const sdk = await createClient(network);

  let keyManager;
  let addressKeyManager;

  if (mnemonic) {
    addressKeyManager = await AddressKeyManager.create({
      sdk,
      mnemonic,
      network,
    });

    if (requireIdentity) {
      keyManager = await IdentityKeyManager.create({
        sdk,
        mnemonic,
        network,
        identityIndex,
      });
    } else {
      keyManager = await IdentityKeyManager.createForNewIdentity({
        sdk,
        mnemonic,
        network,
        identityIndex,
      });
    }
  }

  return /** @type {{ sdk: EvoSDK, keyManager: IdentityKeyManager, addressKeyManager: AddressKeyManager }} */ ({
    sdk,
    keyManager,
    addressKeyManager,
  });
}

export { IdentityKeyManager, AddressKeyManager, clientConfig };
