// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockDataContractConstructor,
  mockSetConfig,
  MockIdentifier,
  identifierFreeMock,
} = vi.hoisted(() => {
  const identifierFreeMock = vi.fn();
  const mockSetConfig = vi.fn();
  class MockIdentifier {
    static last: MockIdentifier | null = null;
    constructor(public readonly id: string) {
      MockIdentifier.last = this;
    }
    free = identifierFreeMock;
  }
  return {
    mockDataContractConstructor: vi.fn(),
    mockSetConfig,
    MockIdentifier,
    identifierFreeMock,
  };
});

vi.mock("@dashevo/evo-sdk", () => ({
  DataContract: function MockDataContract(args: unknown) {
    mockDataContractConstructor(args);
    return { args, setConfig: mockSetConfig };
  },
  Identifier: MockIdentifier,
}));

import {
  DEFAULT_CONTRACT_ID,
  NOTE_SCHEMAS,
  loadStoredContractId,
  refreshContractCache,
  registerContract,
} from "../src/dash/contract";

beforeEach(() => {
  localStorage.clear();
  mockDataContractConstructor.mockReset();
  mockSetConfig.mockReset();
  identifierFreeMock.mockReset();
  MockIdentifier.last = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("NOTE_SCHEMAS", () => {
  it("defines the note contract with timestamps, mutability, and owner/timestamp indices", () => {
    expect(NOTE_SCHEMAS.note.documentsMutable).toBe(true);
    expect(NOTE_SCHEMAS.note.canBeDeleted).toBe(true);
    expect(NOTE_SCHEMAS.note.required).toEqual([
      "$createdAt",
      "$updatedAt",
      "message",
    ]);
    expect(NOTE_SCHEMAS.note.properties.title).toMatchObject({
      type: "string",
      maxLength: 120,
      position: 0,
    });
    expect(NOTE_SCHEMAS.note.properties.message).toMatchObject({
      type: "string",
      maxLength: 10000,
      position: 1,
    });
    expect(NOTE_SCHEMAS.note.indices).toEqual([
      {
        name: "byOwnerUpdated",
        properties: [{ $ownerId: "asc" }, { $updatedAt: "asc" }],
      },
      {
        name: "byOwnerCreated",
        properties: [{ $ownerId: "asc" }, { $createdAt: "asc" }],
      },
    ]);
  });
});

describe("loadStoredContractId", () => {
  it("falls back to the default contract when nothing is stored", () => {
    expect(loadStoredContractId()).toBe(DEFAULT_CONTRACT_ID);
  });

  it("falls back to the default contract when localStorage access throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(loadStoredContractId()).toBe(DEFAULT_CONTRACT_ID);
  });

  it("returns the stored value when present", () => {
    localStorage.setItem("dashnote.contractId", "stored-contract");
    expect(loadStoredContractId()).toBe("stored-contract");
  });
});

describe("refreshContractCache", () => {
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
});

describe("registerContract", () => {
  it("builds the note contract, applies config, publishes it, and persists the ID", async () => {
    const sdk = {
      identities: {
        nonce: vi.fn().mockResolvedValue(4n),
      },
      contracts: {
        publish: vi.fn().mockResolvedValue({
          id: { toString: () => "new-contract-id" },
        }),
      },
    };
    const keyManager = {
      identityId: "identity-1",
      getAuth: vi.fn().mockResolvedValue({
        identity: { id: "identity-1", toString: () => "identity-1" },
        identityKey: "identity-key",
        signer: "signer",
      }),
    };
    const log = vi.fn();

    const id = await registerContract({
      sdk: sdk as never,
      keyManager: keyManager as never,
      log,
    });

    expect(id).toBe("new-contract-id");
    expect(mockDataContractConstructor).toHaveBeenCalledWith({
      ownerId: "identity-1",
      identityNonce: 5n,
      schemas: NOTE_SCHEMAS,
      fullValidation: true,
    });
    expect(mockSetConfig).toHaveBeenCalledWith({
      canBeDeleted: false,
      readonly: false,
      keepsHistory: false,
      documentsKeepHistoryContractDefault: false,
      documentsMutableContractDefault: true,
      documentsCanBeDeletedContractDefault: true,
    });
    expect(localStorage.getItem("dashnote.contractId")).toBe("new-contract-id");
    expect(log).toHaveBeenCalledWith("Registering Dashnote note contract…");
  });
});
