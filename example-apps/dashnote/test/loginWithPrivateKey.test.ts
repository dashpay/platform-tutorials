// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

const { mockFromWIF, mockGetPublicKeyHash, mockSignerAddKeyFromWif } =
  vi.hoisted(() => ({
    mockFromWIF: vi.fn(),
    mockGetPublicKeyHash: vi.fn(),
    mockSignerAddKeyFromWif: vi.fn(),
  }));

vi.mock("@dashevo/evo-sdk", () => ({
  PrivateKey: { fromWIF: mockFromWIF },
  IdentitySigner: function MockSigner() {
    return { addKeyFromWif: mockSignerAddKeyFromWif };
  },
  Purpose: {
    AUTHENTICATION: 0,
    ENCRYPTION: 1,
    TRANSFER: 2,
  },
  SecurityLevel: {
    MASTER: 0,
    CRITICAL: 1,
    HIGH: 2,
    MEDIUM: 3,
  },
}));

import {
  KeyDisabledError,
  InvalidPrivateKeyError,
  loginWithPrivateKey,
  UnknownIdentityError,
  WrongKeyPurposeError,
} from "../src/dash/loginWithPrivateKey";
import type { DashSdk } from "../src/dash/types";

const ourPubKeyHex =
  "02aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899";
const ourPubKeyBytes = (() => {
  const bytes = new Uint8Array(ourPubKeyHex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(ourPubKeyHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
})();
const ourPubKeyBase64 = (() => {
  let binary = "";
  ourPubKeyBytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
})();

function setupValidWifMocks() {
  mockGetPublicKeyHash.mockReturnValue(new Uint8Array(20));
  mockFromWIF.mockReturnValue({
    getPublicKeyHash: mockGetPublicKeyHash,
    getPublicKey: () => ({
      toBytes: () => ourPubKeyBytes,
    }),
  });
}

function makeSdk(byPublicKeyHash: ReturnType<typeof vi.fn>): DashSdk {
  return {
    identities: {
      byPublicKeyHash,
      nonce: vi.fn(),
    },
  } as unknown as DashSdk;
}

afterEach(() => {
  mockFromWIF.mockReset();
  mockGetPublicKeyHash.mockReset();
  mockSignerAddKeyFromWif.mockReset();
});

describe("loginWithPrivateKey", () => {
  it("throws InvalidPrivateKeyError when the WIF can't be parsed", async () => {
    mockFromWIF.mockImplementation(() => {
      throw new Error("bad checksum");
    });
    const sdk = makeSdk(vi.fn());

    await expect(loginWithPrivateKey(sdk, "not-a-key")).rejects.toBeInstanceOf(
      InvalidPrivateKeyError,
    );
  });

  it("throws UnknownIdentityError when no identity matches the key", async () => {
    setupValidWifMocks();
    const byPublicKeyHash = vi.fn().mockResolvedValue(undefined);
    const sdk = makeSdk(byPublicKeyHash);

    await expect(
      loginWithPrivateKey(sdk, "valid-wif-stub"),
    ).rejects.toBeInstanceOf(UnknownIdentityError);
  });

  it("throws WrongKeyPurposeError carrying the identity ID for transfer keys", async () => {
    setupValidWifMocks();
    const identityId = "identity-1";
    const identity = {
      id: identityId,
      toJSON: () => ({
        publicKeys: [
          {
            id: 3,
            purpose: 2, // TRANSFER
            securityLevel: 1, // CRITICAL
            data: ourPubKeyBase64,
          },
        ],
      }),
      getPublicKeyById: vi.fn(),
    };
    const sdk = makeSdk(vi.fn().mockResolvedValue(identity));

    const promise = loginWithPrivateKey(sdk, "valid-wif-stub");
    await expect(promise).rejects.toBeInstanceOf(WrongKeyPurposeError);
    await promise.catch((err: WrongKeyPurposeError) => {
      expect(err.identityId).toBe(identityId);
      expect(err.purposeName).toBe("TRANSFER");
    });
  });

  it("throws KeyDisabledError when the matching key has a disabledAt timestamp", async () => {
    setupValidWifMocks();
    const identityId = "identity-2";
    const identity = {
      id: identityId,
      toJSON: () => ({
        publicKeys: [
          {
            id: 1,
            purpose: 0, // AUTHENTICATION
            securityLevel: 2, // HIGH
            data: ourPubKeyBase64,
            disabledAt: 1700000000,
          },
        ],
      }),
      getPublicKeyById: vi.fn(),
    };
    const sdk = makeSdk(vi.fn().mockResolvedValue(identity));

    const promise = loginWithPrivateKey(sdk, "valid-wif-stub");
    await expect(promise).rejects.toBeInstanceOf(KeyDisabledError);
    await promise.catch((err: KeyDisabledError) => {
      expect(err.identityId).toBe(identityId);
    });
  });

  it("throws KeyDisabledError when the matching key has disabled: true", async () => {
    // Some SDK versions surface the disabled state as a boolean rather than
    // a timestamp. The check must catch both shapes.
    setupValidWifMocks();
    const identityId = "identity-disabled-bool";
    const identity = {
      id: identityId,
      toJSON: () => ({
        publicKeys: [
          {
            id: 1,
            purpose: 0,
            securityLevel: 2,
            data: ourPubKeyBase64,
            disabled: true,
          },
        ],
      }),
      getPublicKeyById: vi.fn(),
    };
    const sdk = makeSdk(vi.fn().mockResolvedValue(identity));

    const promise = loginWithPrivateKey(sdk, "valid-wif-stub");
    await expect(promise).rejects.toBeInstanceOf(KeyDisabledError);
    await promise.catch((err: KeyDisabledError) => {
      expect(err.identityId).toBe(identityId);
    });
  });

  it("throws UnknownIdentityError when the identity has an empty publicKeys array", async () => {
    // Defensive: byPublicKeyHash matched, so a key must exist on the
    // identity. An empty publicKeys[] indicates an SDK shape we don't
    // understand; fail closed rather than guessing.
    setupValidWifMocks();
    const identity = {
      id: "identity-no-keys",
      toJSON: () => ({ publicKeys: [] }),
      getPublicKeyById: vi.fn(),
    };
    const sdk = makeSdk(vi.fn().mockResolvedValue(identity));

    await expect(
      loginWithPrivateKey(sdk, "valid-wif-stub"),
    ).rejects.toBeInstanceOf(UnknownIdentityError);
  });

  it("throws UnknownIdentityError when no publicKeys[].data matches our pubkey bytes", async () => {
    // Defensive: byPublicKeyHash returned an identity, but the JSON
    // encoding of its keys' data field is something we can't reconcile
    // (different encoding, different pubkey shape). Fail closed instead
    // of silently picking the first key.
    setupValidWifMocks();
    // Use a base64 string that contains characters outside [0-9a-fA-F] so
    // tryDecodeKeyData skips its hex branch and exercises the base64 path
    // we actually want to verify here. 33 bytes of 0xff base64-encodes
    // with '/' and '=' — definitively not hex.
    const otherKeyBase64 = btoa("\xff".repeat(33));
    expect(otherKeyBase64).toMatch(/[^0-9a-fA-F]/);
    const identity = {
      id: "identity-encoding-skew",
      toJSON: () => ({
        publicKeys: [
          {
            id: 1,
            purpose: 0,
            securityLevel: 2,
            data: otherKeyBase64,
          },
        ],
      }),
      getPublicKeyById: vi.fn(),
    };
    const sdk = makeSdk(vi.fn().mockResolvedValue(identity));

    await expect(
      loginWithPrivateKey(sdk, "valid-wif-stub"),
    ).rejects.toBeInstanceOf(UnknownIdentityError);
  });

  it("returns the matched key + signer wired with the original WIF", async () => {
    setupValidWifMocks();
    const identityId = "identity-3";
    const identityKey = { mock: "identity-public-key" };
    const getPublicKeyById = vi.fn().mockReturnValue(identityKey);
    const identity = {
      id: identityId,
      toJSON: () => ({
        publicKeys: [
          {
            id: 2,
            purpose: 0, // AUTHENTICATION
            securityLevel: 1, // CRITICAL
            data: ourPubKeyBase64,
          },
        ],
      }),
      getPublicKeyById,
    };
    const sdk = makeSdk(vi.fn().mockResolvedValue(identity));

    const result = await loginWithPrivateKey(sdk, "valid-wif-stub");

    expect(result.identityId).toBe(identityId);
    expect(result.identity).toBe(identity);
    expect(result.identityKey).toBe(identityKey);
    expect(getPublicKeyById).toHaveBeenCalledWith(2);
    expect(mockSignerAddKeyFromWif).toHaveBeenCalledWith("valid-wif-stub");
  });

  it("matches keys whose JSON data is hex-encoded", async () => {
    setupValidWifMocks();
    const identity = {
      id: "identity-hex",
      toJSON: () => ({
        publicKeys: [
          {
            id: 1,
            purpose: 0,
            securityLevel: 2, // HIGH
            data: ourPubKeyHex,
          },
        ],
      }),
      getPublicKeyById: vi.fn().mockReturnValue({}),
    };
    const sdk = makeSdk(vi.fn().mockResolvedValue(identity));

    const result = await loginWithPrivateKey(sdk, "valid-wif-stub");
    expect(result.identityId).toBe("identity-hex");
  });

  describe("security level gate", () => {
    function makeIdentityWithKey(opts: { purpose: number; level: number }) {
      return {
        id: `identity-p${opts.purpose}-l${opts.level}`,
        toJSON: () => ({
          publicKeys: [
            {
              id: 1,
              purpose: opts.purpose,
              securityLevel: opts.level,
              data: ourPubKeyBase64,
            },
          ],
        }),
        getPublicKeyById: vi.fn().mockReturnValue({}),
      };
    }

    // SecurityLevel: MASTER=0, CRITICAL=1, HIGH=2, MEDIUM=3
    // Purpose: AUTHENTICATION=0, ENCRYPTION=1, TRANSFER=2
    // Document/contract operations require AUTHENTICATION + (HIGH | CRITICAL).
    // Anything else must be rejected up front so we don't reach a
    // "level ... is not a valid level for these state transitions" failure
    // mid-flow.
    it.each([
      { purpose: 0, level: 0, name: "AUTHENTICATION + MASTER" },
      { purpose: 0, level: 3, name: "AUTHENTICATION + MEDIUM" },
      { purpose: 1, level: 0, name: "ENCRYPTION + MASTER" },
      { purpose: 1, level: 1, name: "ENCRYPTION + CRITICAL" },
      { purpose: 1, level: 2, name: "ENCRYPTION + HIGH" },
      { purpose: 1, level: 3, name: "ENCRYPTION + MEDIUM" },
      { purpose: 2, level: 0, name: "TRANSFER + MASTER" },
      { purpose: 2, level: 1, name: "TRANSFER + CRITICAL" },
      { purpose: 2, level: 2, name: "TRANSFER + HIGH" },
      { purpose: 2, level: 3, name: "TRANSFER + MEDIUM" },
    ])("rejects $name", async ({ purpose, level }) => {
      setupValidWifMocks();
      const identity = makeIdentityWithKey({ purpose, level });
      const sdk = makeSdk(vi.fn().mockResolvedValue(identity));

      await expect(
        loginWithPrivateKey(sdk, "valid-wif-stub"),
      ).rejects.toBeInstanceOf(WrongKeyPurposeError);
    });

    it.each([
      { level: 1, name: "CRITICAL" },
      { level: 2, name: "HIGH" },
    ])("accepts AUTHENTICATION + $name", async ({ level }) => {
      setupValidWifMocks();
      const identity = makeIdentityWithKey({ purpose: 0, level });
      const sdk = makeSdk(vi.fn().mockResolvedValue(identity));

      const result = await loginWithPrivateKey(sdk, "valid-wif-stub");
      expect(result.identityId).toBe(`identity-p0-l${level}`);
    });
  });
});
