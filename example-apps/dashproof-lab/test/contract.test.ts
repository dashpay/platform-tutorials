// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockDataContractConstructor, MockIdentifier, identifierFreeMock } =
  vi.hoisted(() => {
    const identifierFreeMock = vi.fn();
    class MockIdentifier {
      static last: MockIdentifier | null = null;
      constructor(public readonly id: string) {
        MockIdentifier.last = this;
      }
      free = identifierFreeMock;
    }
    return {
      mockDataContractConstructor: vi.fn(),
      MockIdentifier,
      identifierFreeMock,
    };
  });

vi.mock("@dashevo/evo-sdk", () => ({
  DataContract: function MockDataContract(args: unknown) {
    mockDataContractConstructor(args);
    return { args };
  },
  Identifier: MockIdentifier,
}));

import {
  ANCHOR_CONTRACT,
  DEFAULT_CONTRACT_ID,
  ensureContract,
  loadStoredContractId,
  refreshContractCache,
  registerContract,
} from "../src/dash/contract";

beforeEach(() => {
  localStorage.clear();
  mockDataContractConstructor.mockReset();
  identifierFreeMock.mockReset();
  MockIdentifier.last = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("refreshContractCache", () => {
  it("no-ops when contractId is empty", async () => {
    const sdk = {
      getWasmSdkConnected: vi.fn(),
    };

    await refreshContractCache({ sdk: sdk as never, contractId: "" });

    expect(sdk.getWasmSdkConnected).not.toHaveBeenCalled();
    expect(MockIdentifier.last).toBeNull();
  });

  it("no-ops when sdk lacks getWasmSdkConnected", async () => {
    const sdk = {} as never;
    await refreshContractCache({ sdk, contractId: "contract-1" });
    expect(MockIdentifier.last).toBeNull();
  });

  it("no-ops when wasm has no removeCachedContract", async () => {
    const wasm = {};
    const sdk = {
      getWasmSdkConnected: vi.fn().mockResolvedValue(wasm),
    };

    await refreshContractCache({ sdk: sdk as never, contractId: "contract-1" });

    expect(sdk.getWasmSdkConnected).toHaveBeenCalled();
    expect(MockIdentifier.last).toBeNull();
  });

  it("evicts the cached contract and frees the identifier", async () => {
    const removeCachedContract = vi.fn();
    const sdk = {
      getWasmSdkConnected: vi.fn().mockResolvedValue({ removeCachedContract }),
    };

    await refreshContractCache({ sdk: sdk as never, contractId: "contract-1" });

    expect(MockIdentifier.last?.id).toBe("contract-1");
    expect(removeCachedContract).toHaveBeenCalledWith(MockIdentifier.last);
    expect(identifierFreeMock).toHaveBeenCalledTimes(1);
  });

  it("frees the identifier even if removeCachedContract throws", async () => {
    const removeCachedContract = vi.fn(() => {
      throw new Error("boom");
    });
    const sdk = {
      getWasmSdkConnected: vi.fn().mockResolvedValue({ removeCachedContract }),
    };

    await expect(
      refreshContractCache({ sdk: sdk as never, contractId: "contract-1" }),
    ).rejects.toThrow("boom");

    expect(identifierFreeMock).toHaveBeenCalledTimes(1);
  });
});

describe("loadStoredContractId", () => {
  it("falls back to DEFAULT_CONTRACT_ID when localStorage.getItem throws", () => {
    // Sandboxed iframes / strict cookie settings can make localStorage access
    // throw SecurityError. The session boots from this function, so it must
    // never crash the app.
    const spy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("SecurityError");
      });

    expect(loadStoredContractId()).toBe(DEFAULT_CONTRACT_ID);

    spy.mockRestore();
  });
});

describe("registerContract", () => {
  function makeKeyManager(identityId = "identity-1") {
    return {
      identityId,
      getAuth: vi.fn().mockResolvedValue({
        identity: { id: identityId, toString: () => identityId },
        identityKey: "identity-key",
        signer: "signer",
      }),
    };
  }

  function makeSdk({
    nonce,
    publishResult,
  }: {
    nonce: bigint | null | undefined;
    publishResult: unknown;
  }) {
    return {
      identities: {
        nonce: vi.fn().mockResolvedValue(nonce),
      },
      contracts: {
        publish: vi.fn().mockResolvedValue(publishResult),
      },
    };
  }

  it("bumps the identity nonce, builds the contract from ANCHOR_CONTRACT, and persists the ID", async () => {
    const sdk = makeSdk({
      nonce: 4n,
      publishResult: { id: { toString: () => "new-contract-id" } },
    });
    const keyManager = makeKeyManager("identity-1");
    const log = vi.fn();

    const id = await registerContract({
      sdk: sdk as never,
      keyManager: keyManager as never,
      log,
    });

    expect(id).toBe("new-contract-id");
    expect(sdk.identities.nonce).toHaveBeenCalledWith("identity-1");
    expect(mockDataContractConstructor).toHaveBeenCalledWith({
      ownerId: "identity-1",
      identityNonce: 5n,
      schemas: ANCHOR_CONTRACT.documents,
      fullValidation: true,
    });
    expect(sdk.contracts.publish).toHaveBeenCalledWith({
      dataContract: expect.objectContaining({ args: expect.any(Object) }),
      identityKey: "identity-key",
      signer: "signer",
    });
    expect(localStorage.getItem("dashproof-lab.contractId")).toBe(
      "new-contract-id",
    );
    expect(log).toHaveBeenCalledWith("Registering proof contract…");
    expect(log).toHaveBeenCalledWith(
      "Proof contract registered: new-contract-id",
      "success",
    );
  });

  it("treats a null nonce as 0 when bumping", async () => {
    const sdk = makeSdk({
      nonce: null,
      publishResult: { id: { toString: () => "id-2" } },
    });

    await registerContract({
      sdk: sdk as never,
      keyManager: makeKeyManager() as never,
    });

    expect(mockDataContractConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ identityNonce: 1n }),
    );
  });

  it("falls back to toJSON().id when published.id is missing", async () => {
    const sdk = makeSdk({
      nonce: 0n,
      publishResult: {
        id: undefined,
        toJSON: () => ({ id: "json-id" }),
      },
    });

    const id = await registerContract({
      sdk: sdk as never,
      keyManager: makeKeyManager() as never,
    });

    expect(id).toBe("json-id");
    expect(localStorage.getItem("dashproof-lab.contractId")).toBe("json-id");
  });

  it("throws and does not persist anything when publish yields no id", async () => {
    const sdk = makeSdk({
      nonce: 0n,
      publishResult: {},
    });

    await expect(
      registerContract({
        sdk: sdk as never,
        keyManager: makeKeyManager() as never,
      }),
    ).rejects.toThrow(/no ID/i);

    expect(localStorage.getItem("dashproof-lab.contractId")).toBeNull();
  });
});

describe("ensureContract", () => {
  function makeKeyManager() {
    return {
      identityId: "identity-1",
      getAuth: vi.fn(),
    };
  }

  it("short-circuits when an explicit existingId is supplied", async () => {
    const sdk = {
      identities: { nonce: vi.fn() },
      contracts: { publish: vi.fn() },
    };
    const log = vi.fn();

    const id = await ensureContract({
      sdk: sdk as never,
      keyManager: makeKeyManager() as never,
      existingId: "supplied-contract",
      log,
    });

    expect(id).toBe("supplied-contract");
    expect(sdk.contracts.publish).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      "Using saved contract ID: supplied-contract",
    );
  });

  it("uses the bundled default contract ID when storage is empty", async () => {
    const sdk = {
      identities: { nonce: vi.fn() },
      contracts: { publish: vi.fn() },
    };

    const id = await ensureContract({
      sdk: sdk as never,
      keyManager: makeKeyManager() as never,
    });

    expect(id).toBe(DEFAULT_CONTRACT_ID);
    expect(sdk.contracts.publish).not.toHaveBeenCalled();
  });

  it("uses a previously stored contract ID over the default", async () => {
    localStorage.setItem("dashproof-lab.contractId", "stored-id");
    const sdk = {
      identities: { nonce: vi.fn() },
      contracts: { publish: vi.fn() },
    };

    const id = await ensureContract({
      sdk: sdk as never,
      keyManager: makeKeyManager() as never,
    });

    expect(id).toBe("stored-id");
    expect(sdk.contracts.publish).not.toHaveBeenCalled();
  });

  it("registers a new contract when no ID is reusable", async () => {
    // loadStoredContractId returns DEFAULT_CONTRACT_ID unless STORAGE_KEY is
    // set to an explicit empty string, which is the only way to force the
    // registerContract fallback branch.
    localStorage.setItem("dashproof-lab.contractId", "");

    const sdk = {
      identities: { nonce: vi.fn().mockResolvedValue(0n) },
      contracts: {
        publish: vi
          .fn()
          .mockResolvedValue({ id: { toString: () => "fresh-id" } }),
      },
    };
    const keyManager = {
      identityId: "identity-1",
      getAuth: vi.fn().mockResolvedValue({
        identity: { id: "identity-1", toString: () => "identity-1" },
        identityKey: "k",
        signer: "s",
      }),
    };

    const id = await ensureContract({
      sdk: sdk as never,
      keyManager: keyManager as never,
    });

    expect(id).toBe("fresh-id");
    expect(sdk.contracts.publish).toHaveBeenCalled();
  });
});
