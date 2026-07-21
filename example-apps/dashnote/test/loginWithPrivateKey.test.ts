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
  AmbiguousIdentityError,
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
const ourPubKeyHashHex = "11223344556677889900aabbccddeeff00112233";
const ourPubKeyBytes = (() => {
  const bytes = new Uint8Array(ourPubKeyHex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(ourPubKeyHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
})();
const ourPubKeyHashBytes = (() => {
  const bytes = new Uint8Array(ourPubKeyHashHex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(ourPubKeyHashHex.slice(i * 2, i * 2 + 2), 16);
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
const ourPubKeyHashBase64 = (() => {
  let binary = "";
  ourPubKeyHashBytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
})();

function privateKey(hash: string | Uint8Array = "hash") {
  return {
    getPublicKeyHash: () => hash,
    getPublicKey: () => ({
      toBytes: () => ourPubKeyBytes,
    }),
  };
}

function identity({
  id = "identity-1",
  purpose = AUTHENTICATION,
  securityLevel = CRITICAL,
  type = undefined as number | undefined,
  disabled = false,
  disabledAt = null as number | string | null,
  data = ourPubKeyBase64,
} = {}) {
  const identityKey = { id: 2 };
  return {
    id: { toString: () => id },
    getPublicKeyById: vi.fn().mockReturnValue(identityKey),
    toJSON: () => ({
      publicKeys: [
        {
          id: 2,
          purpose,
          securityLevel,
          type,
          data,
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
      fetch: vi.fn().mockResolvedValue(undefined),
      byPublicKeyHash: vi.fn().mockResolvedValue(value),
      byNonUniquePublicKeyHash: vi.fn().mockResolvedValue([]),
    },
  } as unknown as DashSdk;
}

function sdkWithLookups(unique: unknown, nonUnique: unknown[]): DashSdk {
  return {
    identities: {
      fetch: vi.fn().mockImplementation(async (identityId: string) =>
        nonUnique.find((candidate) => {
          const id = (candidate as { id?: string | { toString(): string } }).id;
          return typeof id === "string"
            ? id === identityId
            : id?.toString() === identityId;
        }),
      ),
      byPublicKeyHash: vi.fn().mockResolvedValue(unique),
      byNonUniquePublicKeyHash: vi
        .fn()
        .mockImplementation(async (_hash, startAfter) =>
          startAfter ? [] : nonUnique,
        ),
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

  it("rejects invalid WIF input through the signer-building login path", async () => {
    fromWIF.mockImplementation(() => {
      throw new Error("invalid");
    });

    await expect(
      loginWithPrivateKey(sdkWithIdentity(null), "not-a-wif"),
    ).rejects.toBeInstanceOf(InvalidPrivateKeyError);
    expect(addKeyFromWif).not.toHaveBeenCalled();
  });

  it("rejects keys with no registered identity", async () => {
    fromWIF.mockReturnValue(privateKey());

    await expect(
      resolveIdentityFromWif(sdkWithIdentity(null), "wif"),
    ).rejects.toBeInstanceOf(UnknownIdentityError);
  });

  it("falls back to non-unique public-key-hash lookup", async () => {
    const resolvedIdentity = identity({
      id: "identity-non-unique",
      data: ourPubKeyHashBase64,
    });
    fromWIF.mockReturnValue(privateKey(ourPubKeyHashHex));

    const result = await loginWithPrivateKey(
      sdkWithLookups(null, [resolvedIdentity]),
      "wif",
    );

    expect(result.identity).toBe(resolvedIdentity);
    expect(result.identityId).toBe("identity-non-unique");
    expect(result.identityKey).toEqual({ id: 2 });
    expect(addKeyFromWif).toHaveBeenCalledWith("wif");
  });

  it("matches base64-encoded public-key hash data", async () => {
    fromWIF.mockReturnValue(privateKey(ourPubKeyHashHex));

    const result = await loginWithPrivateKey(
      sdkWithIdentity(identity({ data: ourPubKeyHashBase64 })),
      "wif",
    );

    expect(result.identityId).toBe("identity-1");
  });

  it("matches hex-encoded public-key hash data", async () => {
    fromWIF.mockReturnValue(privateKey(ourPubKeyHashBytes));

    const result = await loginWithPrivateKey(
      sdkWithIdentity(identity({ data: ourPubKeyHashHex })),
      "wif",
    );

    expect(result.identityId).toBe("identity-1");
  });

  it.each([3, 4])(
    "rejects HASH160 bytes belonging to key type %s",
    async (type) => {
      fromWIF.mockReturnValue(privateKey(ourPubKeyHashHex));

      await expect(
        resolveIdentityFromWif(
          sdkWithLookups(null, [identity({ data: ourPubKeyHashBase64, type })]),
          "wif",
        ),
      ).rejects.toBeInstanceOf(UnknownIdentityError);
    },
  );

  it("fetches and verifies an explicitly selected identity directly", async () => {
    const identityA = identity({
      id: "identity-a",
      data: ourPubKeyHashBase64,
      type: 2,
    });
    const identityB = identity({
      id: "identity-b",
      data: ourPubKeyHashBase64,
      type: 2,
    });
    fromWIF.mockReturnValue(privateKey(ourPubKeyHashHex));
    const sdk = sdkWithLookups(null, [identityB, identityA]);

    const result = await resolveIdentityFromWif(sdk, "wif", "identity-a");

    expect(result.identityId).toBe("identity-a");
    expect(sdk.identities.fetch).toHaveBeenCalledWith("identity-a");
    expect(sdk.identities.byNonUniquePublicKeyHash).not.toHaveBeenCalled();
  });

  it("rejects an explicitly selected identity that does not match the WIF", async () => {
    fromWIF.mockReturnValue(privateKey(ourPubKeyHashHex));

    await expect(
      resolveIdentityFromWif(
        sdkWithLookups(null, [
          identity({ id: "identity-a", data: ourPubKeyHashBase64 }),
        ]),
        "wif",
        "identity-other",
      ),
    ).rejects.toBeInstanceOf(UnknownIdentityError);
  });

  it("continues pagination until a second match establishes ambiguity", async () => {
    const identityA = identity({ id: "identity-a" });
    const identityB = identity({ id: "identity-b" });
    fromWIF.mockReturnValue(privateKey());
    const byNonUniquePublicKeyHash = vi
      .fn()
      .mockImplementation(async (_hash, startAfter) => {
        if (!startAfter) return [identityA];
        if (startAfter === "identity-a") return [identityB];
        return [];
      });
    const sdk = {
      identities: {
        fetch: vi.fn(),
        byPublicKeyHash: vi.fn().mockResolvedValue(undefined),
        byNonUniquePublicKeyHash,
      },
    } as unknown as DashSdk;

    await expect(resolveIdentityFromWif(sdk, "wif")).rejects.toBeInstanceOf(
      AmbiguousIdentityError,
    );
    expect(byNonUniquePublicKeyHash).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      "identity-a",
    );
  });

  it("rejects ambiguous non-unique identity matches", async () => {
    fromWIF.mockReturnValue(privateKey(ourPubKeyHashHex));

    await expect(
      loginWithPrivateKey(
        sdkWithLookups(null, [
          identity({ id: "identity-a", data: ourPubKeyHashBase64 }),
          identity({ id: "identity-b", data: ourPubKeyHashBase64 }),
        ]),
        "wif",
      ),
    ).rejects.toBeInstanceOf(AmbiguousIdentityError);
    expect(addKeyFromWif).not.toHaveBeenCalled();
  });

  it("rejects multiple matches when only one has a valid authentication key", async () => {
    fromWIF.mockReturnValue(privateKey(ourPubKeyHashHex));

    await expect(
      resolveIdentityFromWif(
        sdkWithLookups(null, [
          identity({ id: "identity-valid", data: ourPubKeyHashBase64 }),
          identity({
            id: "identity-wrong-purpose",
            purpose: TRANSFER,
            data: ourPubKeyHashBase64,
          }),
        ]),
        "wif",
      ),
    ).rejects.toBeInstanceOf(AmbiguousIdentityError);
  });

  it("rejects empty non-unique lookup results", async () => {
    fromWIF.mockReturnValue(privateKey(ourPubKeyHashHex));

    await expect(
      resolveIdentityFromWif(sdkWithLookups(null, []), "wif"),
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

  it("rejects identities whose serialized public-key list is empty", async () => {
    fromWIF.mockReturnValue(privateKey());
    const identityWithoutKeys = {
      id: "identity-no-keys",
      getPublicKeyById: vi.fn(),
      toJSON: () => ({ publicKeys: [] }),
    };

    await expect(
      resolveIdentityFromWif(sdkWithIdentity(identityWithoutKeys), "wif"),
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

  it("applies the same purpose validation without constructing a signer", async () => {
    fromWIF.mockReturnValue(privateKey());

    await expect(
      resolveIdentityFromWif(
        sdkWithIdentity(identity({ purpose: TRANSFER })),
        "wif",
      ),
    ).rejects.toBeInstanceOf(WrongKeyPurposeError);
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
