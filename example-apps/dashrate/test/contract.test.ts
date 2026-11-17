import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearStoredContractId,
  DEFAULT_CONTRACT_ID,
  loadStoredContractId,
  REVIEW_SCHEMAS,
  saveContractId,
} from "../src/dash/contract";

const STORAGE_KEY = "dashrate.contractId";

describe("DashRate review contract schema", () => {
  it("keeps review documents mutable with history enabled", () => {
    expect(REVIEW_SCHEMAS.review.documentsMutable).toBe(true);
    expect(REVIEW_SCHEMAS.review.documentsKeepHistory).toBe(true);
    expect(REVIEW_SCHEMAS.review.canBeDeleted).toBe(false);
  });

  it("defines the rating fields", () => {
    expect(REVIEW_SCHEMAS.review.properties.resourceId.type).toBe("string");
    // ≤ 59: the node rejects a longer string on an index with a ranked axis.
    expect(REVIEW_SCHEMAS.review.properties.resourceId.maxLength).toBe(59);
    expect(REVIEW_SCHEMAS.review.properties.rating.minimum).toBe(1);
    expect(REVIEW_SCHEMAS.review.properties.rating.maximum).toBe(5);
  });

  it("matches the indices of the published default contract exactly", () => {
    // Literal copy of the schema published as DEFAULT_CONTRACT_ID, so
    // "Register a fresh contract" in Settings yields an equivalent contract.
    // Indices are immutable once published — change this deliberately.
    expect(REVIEW_SCHEMAS.review.indices).toEqual([
      {
        name: "ownerAndResource",
        unique: true,
        properties: [{ $ownerId: "asc" }, { resourceId: "asc" }],
      },
      {
        name: "ownerReviews",
        properties: [{ $ownerId: "asc" }, { $updatedAt: "asc" }],
      },
      {
        name: "resourceRating",
        properties: [{ resourceId: "asc" }],
        averageable: "rating",
        rangeAverageable: true,
        rankedAverageable: true,
        rankedCountable: true,
      },
      {
        name: "resourceRatingDistribution",
        properties: [{ resourceId: "asc" }, { rating: "asc" }],
        countable: "countable",
        rangeCountable: true,
      },
      {
        name: "resourceRecent",
        properties: [{ resourceId: "asc" }, { $updatedAt: "asc" }],
      },
      {
        name: "resourceRatingRecent",
        properties: [
          { resourceId: "asc" },
          { rating: "asc" },
          { $updatedAt: "asc" },
        ],
      },
    ]);
    expect(REVIEW_SCHEMAS.review.required).toEqual([
      "$createdAt",
      "$updatedAt",
      "resourceId",
      "rating",
    ]);
  });

  it("keeps the distribution index unranked", () => {
    // A compound ranked index under the averageable [resourceId] prefix is
    // rejected at registration.
    const distribution = REVIEW_SCHEMAS.review.indices.find(
      (index) => index.name === "resourceRatingDistribution",
    );
    expect(distribution).not.toHaveProperty("rankedCountable");
    expect(distribution).not.toHaveProperty("rankedAverageable");
  });
});

describe("contract id storage helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubStorage(impl: Partial<Storage>): Storage {
    const storage = {
      getItem: vi.fn<Storage["getItem"]>(() => null),
      setItem: vi.fn<Storage["setItem"]>(),
      removeItem: vi.fn<Storage["removeItem"]>(),
      ...impl,
    } as unknown as Storage;
    vi.stubGlobal("localStorage", storage);
    return storage;
  }

  it("reads a stored id, falling back to the default", () => {
    stubStorage({ getItem: vi.fn(() => "stored-id") });
    expect(loadStoredContractId()).toBe("stored-id");

    stubStorage({ getItem: vi.fn(() => null) });
    expect(loadStoredContractId()).toBe(DEFAULT_CONTRACT_ID);
  });

  it("returns the default when reading throws", () => {
    stubStorage({
      getItem: vi.fn(() => {
        throw new Error("storage disabled");
      }),
    });
    expect(loadStoredContractId()).toBe(DEFAULT_CONTRACT_ID);
  });

  it("writes and clears the stored id", () => {
    const storage = stubStorage({});
    saveContractId("abc");
    expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, "abc");
    clearStoredContractId();
    expect(storage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it("swallows write/clear failures so persistence stays best-effort", () => {
    stubStorage({
      setItem: vi.fn(() => {
        throw new Error("quota exceeded");
      }),
      removeItem: vi.fn(() => {
        throw new Error("storage disabled");
      }),
    });
    // A failed persist must not surface as an error (e.g. Safari private mode
    // must not turn a successful contract publish into a failure).
    expect(() => saveContractId("abc")).not.toThrow();
    expect(() => clearStoredContractId()).not.toThrow();
  });
});
