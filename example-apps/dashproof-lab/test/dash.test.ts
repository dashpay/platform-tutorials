// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

const { mockDocumentConstructor } = vi.hoisted(() => ({
  mockDocumentConstructor: vi.fn(),
}));

vi.mock("@dashevo/evo-sdk", () => ({
  Document: function MockDocument(args: unknown) {
    mockDocumentConstructor(args);
    return { args };
  },
}));

import { createAnchor } from "../src/dash/createAnchor";
import {
  clearStoredContractId,
  loadStoredContractId,
  saveContractId,
} from "../src/dash/contract";
import { EXAMPLE_FILE_FIXTURES } from "../src/data/exampleFiles";
import { normalizeAnchors } from "../src/dash/queries";
import { suggestChainId } from "../src/lib/chainId";
import { areBytesEqual, bytesToHex, hashFile } from "../src/lib/hash";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));

describe("dashproof helpers", () => {
  it("hashFile matches the known SHA-256 values for repo fixture files", async () => {
    for (const fixture of EXAMPLE_FILE_FIXTURES) {
      const absolutePath = resolve(
        TEST_DIR,
        "../public/example-files",
        fixture.filename,
      );
      const bytes = readFileSync(absolutePath);
      const file = {
        async arrayBuffer() {
          return bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          );
        },
      } as File;
      const digest = await hashFile(file);

      expect(bytesToHex(digest)).toBe(fixture.sha256Hex);
    }
  });

  it("areBytesEqual compares hashes by byte value", () => {
    expect(
      areBytesEqual(Uint8Array.from([1, 2, 3]), Uint8Array.from([1, 2, 3])),
    ).toBe(true);
    expect(
      areBytesEqual(Uint8Array.from([1, 2, 3]), Uint8Array.from([1, 2, 4])),
    ).toBe(false);
  });

  it("suggestChainId prefers known fixture mappings and otherwise slugifies filenames", () => {
    expect(
      suggestChainId({
        filename: "whatever.txt",
        hashHex: EXAMPLE_FILE_FIXTURES[1]?.sha256Hex,
      }),
    ).toBe(EXAMPLE_FILE_FIXTURES[1]?.chainId);

    expect(
      suggestChainId({
        filename: "Quarterly Audit Report.pdf",
      }),
    ).toBe("quarterly-audit-report");
  });

  it("normalizeAnchors handles arrays, maps, and object-like results", () => {
    const arrayResult = normalizeAnchors([
      {
        toJSON() {
          return {
            $id: "anchor-1",
            $ownerId: "owner-1",
            $createdAt: 1000,
            entryHash: [1, 2, 3],
            chainId: "demo",
            filename: "proof.pdf",
          };
        },
      },
    ]);
    expect(arrayResult[0]).toMatchObject({
      id: "anchor-1",
      ownerId: "owner-1",
      createdAt: 1000,
      chainId: "demo",
      filename: "proof.pdf",
      entryHashHex: "010203",
    });

    const mapResult = normalizeAnchors(
      new Map([
        [
          "anchor-2",
          {
            $ownerId: "owner-2",
            $createdAt: "2000",
            entryHash: Uint8Array.from([4, 5, 6]),
            chainId: "chain-two",
          },
        ],
      ]),
    );
    expect(mapResult[0]).toMatchObject({
      id: "anchor-2",
      ownerId: "owner-2",
      createdAt: 2000,
      chainId: "chain-two",
      entryHashHex: "040506",
    });

    const objectResult = normalizeAnchors({
      "anchor-3": {
        $ownerId: "owner-3",
        $createdAt: 3000n,
        entryHash: { data: [7, 8, 9] },
        chainId: "chain-three",
      },
    });
    expect(objectResult[0]).toMatchObject({
      id: "anchor-3",
      ownerId: "owner-3",
      createdAt: 3000,
      chainId: "chain-three",
      entryHashHex: "070809",
    });
  });

  it("createAnchor rejects a missing chainId", async () => {
    await expect(
      createAnchor({
        sdk: {
          documents: {
            create: async () => undefined,
          },
        },
        keyManager: {
          async getAuth() {
            return {
              identity: { id: "identity-1" },
              identityKey: undefined,
              signer: undefined,
            };
          },
        },
        contractId: "contract-1",
        anchor: {
          entryHash: new Uint8Array(32),
          chainId: "   ",
          note: " hi ",
        },
      }),
    ).rejects.toThrow("Chain ID is required.");
  });

  it("createAnchor trims optional fields before document creation", async () => {
    mockDocumentConstructor.mockReset();
    const mockDocumentsCreate = vi.fn().mockResolvedValue(undefined);

    await createAnchor({
      sdk: {
        documents: {
          create: mockDocumentsCreate,
        },
      },
      keyManager: {
        async getAuth() {
          return {
            identity: { id: "identity-1" },
            identityKey: "identity-key",
            signer: "signer",
          };
        },
      },
      contractId: "contract-1",
      anchor: {
        entryHash: new Uint8Array(32).fill(4),
        chainId: "  chain-1  ",
        filename: "  proof.txt  ",
        mimeType: "  text/plain  ",
        size: 12.8,
        note: "  hello  ",
      },
    });

    expect(mockDocumentConstructor).toHaveBeenCalledWith({
      properties: {
        entryHash: "BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ=",
        chainId: "chain-1",
        filename: "proof.txt",
        mimeType: "text/plain",
        size: 12,
        note: "hello",
      },
      documentTypeName: "anchor",
      dataContractId: "contract-1",
      ownerId: "identity-1",
    });
    expect(mockDocumentsCreate).toHaveBeenCalledWith({
      document: {
        args: {
          properties: {
            entryHash: "BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ=",
            chainId: "chain-1",
            filename: "proof.txt",
            mimeType: "text/plain",
            size: 12,
            note: "hello",
          },
          documentTypeName: "anchor",
          dataContractId: "contract-1",
          ownerId: "identity-1",
        },
      },
      identityKey: "identity-key",
      signer: "signer",
    });
  });

  it("createAnchor omits blank optional string fields", async () => {
    mockDocumentConstructor.mockReset();
    const mockDocumentsCreate = vi.fn().mockResolvedValue(undefined);

    await createAnchor({
      sdk: {
        documents: {
          create: mockDocumentsCreate,
        },
      },
      keyManager: {
        async getAuth() {
          return {
            identity: { id: "identity-1" },
            identityKey: undefined,
            signer: undefined,
          };
        },
      },
      contractId: "contract-1",
      anchor: {
        entryHash: new Uint8Array(32).fill(5),
        chainId: "chain-2",
        filename: "   ",
        mimeType: "   ",
        note: "   ",
      },
    });

    expect(mockDocumentConstructor).toHaveBeenCalledWith({
      properties: {
        entryHash: "BQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU=",
        chainId: "chain-2",
      },
      documentTypeName: "anchor",
      dataContractId: "contract-1",
      ownerId: "identity-1",
    });
    expect(mockDocumentsCreate).toHaveBeenCalledTimes(1);
  });

  it("persists and clears the stored contract ID", () => {
    localStorage.clear();

    expect(loadStoredContractId()).toBeNull();
    saveContractId("contract-123");
    expect(loadStoredContractId()).toBe("contract-123");
    clearStoredContractId();
    expect(loadStoredContractId()).toBeNull();
  });
});
