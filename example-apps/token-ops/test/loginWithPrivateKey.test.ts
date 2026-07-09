import { afterEach, describe, expect, it, vi } from "vitest";

const fromWIF = vi.hoisted(() => vi.fn());
const addKeyFromWif = vi.hoisted(() => vi.fn());

vi.mock("@dashevo/evo-sdk", () => ({
  IdentitySigner: class {
    addKeyFromWif = addKeyFromWif;
  },
  PrivateKey: {
    fromWIF,
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
  InvalidPrivateKeyError,
  KeyDisabledError,
  UnknownIdentityError,
  WrongKeyPurposeError,
  loginWithPrivateKey,
  resolveIdentityFromWif,
} from "../src/dash/loginWithPrivateKey";
import type { DashSdk } from "../src/dash/types";

const AUTHENTICATION = 0;
const ENCRYPTION = 1;
const TRANSFER = 2;
const MASTER = 0;
const CRITICAL = 1;
const HIGH = 2;
const MEDIUM = 3;

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
  ourPubKeyBytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
})();

function privateKey() {
  return {
    getPublicKeyHash: () => "hash",
    getPublicKey: () => ({
      toBytes: () => ourPubKeyBytes,
    }),
  };
}

function identity({
  purpose = AUTHENTICATION,
  securityLevel = CRITICAL,
  disabled = false,
  disabledAt = null as number | string | null,
} = {}) {
  const identityKey = { id: 2 };
  return {
    id: { toString: () => "identity-1" },
    getPublicKeyById: vi.fn().mockReturnValue(identityKey),
    toJSON: () => ({
      publicKeys: [
        {
          id: 2,
          purpose,
          securityLevel,
          data: ourPubKeyBase64,
          disabled,
          disabledAt,
        },
      ],
    }),
  };
}

function sdkWithIdentity(value: unknown): DashSdk {
  return {
    identities: {
      byPublicKeyHash: vi.fn().mockResolvedValue(value),
    },
  } as unknown as DashSdk;
}

describe("loginWithPrivateKey", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid WIF input", async () => {
    fromWIF.mockImplementation(() => {
      throw new Error("invalid");
    });

    await expect(
      resolveIdentityFromWif(sdkWithIdentity(null), "not-a-wif"),
    ).rejects.toBeInstanceOf(InvalidPrivateKeyError);
  });

  it("rejects keys with no registered identity", async () => {
    fromWIF.mockReturnValue(privateKey());

    await expect(
      resolveIdentityFromWif(sdkWithIdentity(null), "wif"),
    ).rejects.toBeInstanceOf(UnknownIdentityError);
  });

  it("rejects non-authentication keys", async () => {
    fromWIF.mockReturnValue(privateKey());

    const promise = resolveIdentityFromWif(
      sdkWithIdentity(identity({ purpose: TRANSFER })),
      "wif",
    );

    await expect(promise).rejects.toBeInstanceOf(WrongKeyPurposeError);
    await promise.catch((err: WrongKeyPurposeError) => {
      expect(err.identityId).toBe("identity-1");
      expect(err.purposeName).toBe("TRANSFER");
      expect(err.securityLevelName).toBe("CRITICAL");
    });
  });

  it("labels MASTER auth keys on wrong-purpose errors", async () => {
    fromWIF.mockReturnValue(privateKey());

    const promise = resolveIdentityFromWif(
      sdkWithIdentity(identity({ securityLevel: MASTER })),
      "wif",
    );

    await expect(promise).rejects.toBeInstanceOf(WrongKeyPurposeError);
    await promise.catch((err: WrongKeyPurposeError) => {
      expect(err.purposeName).toBe("AUTHENTICATION");
      expect(err.securityLevelName).toBe("MASTER");
    });
  });

  it("rejects keys whose public key data cannot be matched", async () => {
    fromWIF.mockReturnValue(privateKey());
    const otherIdentity = {
      id: "identity-encoding-skew",
      getPublicKeyById: vi.fn(),
      toJSON: () => ({
        publicKeys: [
          {
            id: 2,
            purpose: AUTHENTICATION,
            securityLevel: HIGH,
            data: btoa("\xff".repeat(33)),
          },
        ],
      }),
    };

    await expect(
      resolveIdentityFromWif(sdkWithIdentity(otherIdentity), "wif"),
    ).rejects.toBeInstanceOf(UnknownIdentityError);
  });

  it("rejects disabled keys", async () => {
    fromWIF.mockReturnValue(privateKey());

    await expect(
      resolveIdentityFromWif(
        sdkWithIdentity(identity({ disabledAt: 123 })),
        "wif",
      ),
    ).rejects.toBeInstanceOf(KeyDisabledError);
  });

  it("rejects disabled keys surfaced as a boolean", async () => {
    fromWIF.mockReturnValue(privateKey());

    await expect(
      resolveIdentityFromWif(
        sdkWithIdentity(identity({ disabled: true })),
        "wif",
      ),
    ).rejects.toBeInstanceOf(KeyDisabledError);
  });

  it("returns auth data and signer for a valid auth key", async () => {
    const resolvedIdentity = identity();
    fromWIF.mockReturnValue(privateKey());

    const result = await loginWithPrivateKey(
      sdkWithIdentity(resolvedIdentity),
      "wif",
    );

    expect(result.identity).toBe(resolvedIdentity);
    expect(result.identityId).toBe("identity-1");
    expect(result.identityKey).toEqual({ id: 2 });
    expect(addKeyFromWif).toHaveBeenCalledWith("wif");
  });

  it("matches keys whose public-key data is hex-encoded", async () => {
    const resolvedIdentity = {
      id: "identity-hex",
      getPublicKeyById: vi.fn().mockReturnValue({ id: 1 }),
      toJSON: () => ({
        publicKeys: [
          {
            id: 1,
            purpose: AUTHENTICATION,
            securityLevel: HIGH,
            data: ourPubKeyHex,
          },
        ],
      }),
    };
    fromWIF.mockReturnValue(privateKey());

    const result = await loginWithPrivateKey(
      sdkWithIdentity(resolvedIdentity),
      "wif",
    );

    expect(result.identityId).toBe("identity-hex");
    expect(result.identityKey).toEqual({ id: 1 });
  });

  it("resolves WIF identity details without constructing a signer", async () => {
    const resolvedIdentity = identity({ securityLevel: HIGH });
    fromWIF.mockReturnValue(privateKey());

    const result = await resolveIdentityFromWif(
      sdkWithIdentity(resolvedIdentity),
      "wif",
    );

    expect(result.identity).toBe(resolvedIdentity);
    expect(result.identityId).toBe("identity-1");
    expect(result.matched.id).toBe(2);
    expect(result.identityKey).toEqual({ id: 2 });
    expect(addKeyFromWif).not.toHaveBeenCalled();
  });

  it.each([
    { purpose: AUTHENTICATION, securityLevel: MASTER },
    { purpose: AUTHENTICATION, securityLevel: MEDIUM },
    { purpose: ENCRYPTION, securityLevel: MASTER },
    { purpose: ENCRYPTION, securityLevel: CRITICAL },
    { purpose: ENCRYPTION, securityLevel: HIGH },
    { purpose: ENCRYPTION, securityLevel: MEDIUM },
    { purpose: TRANSFER, securityLevel: MASTER },
    { purpose: TRANSFER, securityLevel: CRITICAL },
    { purpose: TRANSFER, securityLevel: HIGH },
    { purpose: TRANSFER, securityLevel: MEDIUM },
  ])("rejects unsupported key purpose/level %#", async (key) => {
    fromWIF.mockReturnValue(privateKey());

    await expect(
      loginWithPrivateKey(sdkWithIdentity(identity(key)), "wif"),
    ).rejects.toBeInstanceOf(WrongKeyPurposeError);
  });

  it.each([CRITICAL, HIGH])(
    "accepts authentication key security level %i",
    async (securityLevel) => {
      fromWIF.mockReturnValue(privateKey());

      const result = await loginWithPrivateKey(
        sdkWithIdentity(identity({ securityLevel })),
        "wif",
      );

      expect(result.identityId).toBe("identity-1");
    },
  );
});
