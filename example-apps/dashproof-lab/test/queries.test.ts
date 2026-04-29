// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

const { mockRefreshContractCache } = vi.hoisted(() => ({
  mockRefreshContractCache: vi.fn(),
}));

vi.mock("../src/dash/contract", () => ({
  refreshContractCache: mockRefreshContractCache,
}));

import {
  findAnchorByHash,
  listAnchorsByChain,
  listAnchorsByOwner,
} from "../src/dash/queries";

afterEach(() => {
  mockRefreshContractCache.mockReset();
});

function makeSdk(documents: unknown[]) {
  return {
    documents: {
      query: vi.fn().mockResolvedValue(documents),
    },
  };
}

describe("queries", () => {
  describe("findAnchorByHash", () => {
    it("queries by base64-encoded entryHash and returns the first match", async () => {
      const sdk = makeSdk([
        {
          $id: "doc-1",
          $ownerId: "owner-1",
          $createdAt: 1000,
          entryHash: "AQIDBAU=",
          chainId: "demo",
        },
      ]);
      const log = vi.fn();

      const result = await findAnchorByHash({
        sdk: sdk as never,
        contractId: "contract-1",
        entryHash: Uint8Array.from([1, 2, 3, 4, 5]),
        log,
      });

      expect(mockRefreshContractCache).toHaveBeenCalledWith({
        sdk,
        contractId: "contract-1",
      });
      expect(sdk.documents.query).toHaveBeenCalledWith({
        dataContractId: "contract-1",
        documentTypeName: "anchor",
        where: [["entryHash", "==", "AQIDBAU="]],
        orderBy: [["entryHash", "asc"]],
        limit: 1,
      });
      expect(result?.id).toBe("doc-1");
      expect(result?.chainId).toBe("demo");
      expect(log).toHaveBeenCalled();
    });

    it("returns null when no document matches", async () => {
      const sdk = makeSdk([]);

      const result = await findAnchorByHash({
        sdk: sdk as never,
        contractId: "contract-1",
        entryHash: new Uint8Array(32),
      });

      expect(result).toBeNull();
    });
  });

  describe("listAnchorsByOwner", () => {
    it("queries by owner and returns records sorted newest-first", async () => {
      const sdk = makeSdk([
        {
          $id: "doc-old",
          $ownerId: "owner-1",
          $createdAt: 1000,
          entryHash: "AQID",
          chainId: "chain-a",
        },
        {
          $id: "doc-new",
          $ownerId: "owner-1",
          $createdAt: 5000,
          entryHash: "AQID",
          chainId: "chain-a",
        },
      ]);

      const records = await listAnchorsByOwner({
        sdk: sdk as never,
        contractId: "contract-1",
        ownerId: "owner-1",
      });

      expect(mockRefreshContractCache).toHaveBeenCalledWith({
        sdk,
        contractId: "contract-1",
      });
      expect(sdk.documents.query).toHaveBeenCalledWith({
        dataContractId: "contract-1",
        documentTypeName: "anchor",
        where: [["$ownerId", "==", "owner-1"]],
        orderBy: [
          ["$ownerId", "asc"],
          ["$createdAt", "asc"],
        ],
        limit: 100,
      });
      expect(records.map((r) => r.id)).toEqual(["doc-new", "doc-old"]);
    });

    it("forwards a custom limit", async () => {
      const sdk = makeSdk([]);

      await listAnchorsByOwner({
        sdk: sdk as never,
        contractId: "contract-1",
        ownerId: "owner-1",
        limit: 5,
      });

      expect(sdk.documents.query).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5 }),
      );
    });
  });

  describe("listAnchorsByChain", () => {
    it("trims the chainId, queries, and returns records sorted oldest-first", async () => {
      const sdk = makeSdk([
        {
          $id: "doc-new",
          $ownerId: "owner-1",
          $createdAt: 5000,
          entryHash: "AQID",
          chainId: "demo",
        },
        {
          $id: "doc-old",
          $ownerId: "owner-1",
          $createdAt: 1000,
          entryHash: "AQID",
          chainId: "demo",
        },
      ]);

      const records = await listAnchorsByChain({
        sdk: sdk as never,
        contractId: "contract-1",
        chainId: "  demo  ",
      });

      expect(sdk.documents.query).toHaveBeenCalledWith({
        dataContractId: "contract-1",
        documentTypeName: "anchor",
        where: [["chainId", "==", "demo"]],
        orderBy: [
          ["chainId", "asc"],
          ["$createdAt", "asc"],
        ],
        limit: 100,
      });
      expect(records.map((r) => r.id)).toEqual(["doc-old", "doc-new"]);
    });

    it("returns an empty array without calling the SDK when chainId is blank", async () => {
      const sdk = makeSdk([]);

      const records = await listAnchorsByChain({
        sdk: sdk as never,
        contractId: "contract-1",
        chainId: "   ",
      });

      expect(records).toEqual([]);
      expect(sdk.documents.query).not.toHaveBeenCalled();
      expect(mockRefreshContractCache).not.toHaveBeenCalled();
    });
  });
});
