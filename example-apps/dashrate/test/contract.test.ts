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

  it("defines rating fields and aggregate-friendly indices", () => {
    expect(REVIEW_SCHEMAS.review.properties.resourceId.type).toBe("string");
    expect(REVIEW_SCHEMAS.review.properties.resourceId.maxLength).toBe(63);
    expect(REVIEW_SCHEMAS.review.properties.rating.minimum).toBe(1);
    expect(REVIEW_SCHEMAS.review.properties.rating.maximum).toBe(5);

    const indexNames = REVIEW_SCHEMAS.review.indices.map((index) => index.name);
    expect(indexNames).toContain("ownerAndResource");
    expect(indexNames).toContain("ownerReviews");
    expect(indexNames).toContain("resourceRatingAggregate");
    expect(indexNames).toContain("resourceRatingDistribution");
    const aggregate = REVIEW_SCHEMAS.review.indices.find(
      (index) => index.name === "resourceRatingAggregate",
    );
    expect(aggregate).toMatchObject({
      properties: [{ resourceId: "asc" }],
      countable: "countable",
    });
    // Must stay count-only: a `summable` here makes the resourceId value
    // tree count+sum, which conflicts with the count-only rating
    // continuation of resourceRatingDistribution and breaks all inserts.
    expect(aggregate).not.toHaveProperty("summable");
  });

  it("indexes [resourceId, rating] count-only for grouped distribution", () => {
    // Backs the grouped `count` GROUP BY rating (distribution) and the
    // `rating == N` filter. Count-only (no summable) so it shares the
    // resourceId prefix with resourceRatingAggregate without conflict.
    const distribution = REVIEW_SCHEMAS.review.indices.find(
      (index) => index.name === "resourceRatingDistribution",
    );
    expect(distribution).toMatchObject({
      properties: [{ resourceId: "asc" }, { rating: "asc" }],
      countable: "countable",
      rangeCountable: true,
    });
    expect(distribution).not.toHaveProperty("summable");
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
