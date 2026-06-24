import { describe, expect, it, vi } from "vitest";
import {
  getRatingDistribution,
  listResourceReviews,
  normalizeReviews,
  ratingKeyHex,
  summaryFromDistribution,
} from "../src/dash/queries";
import type { DashSdk } from "../src/dash/types";

describe("DashRate query normalization", () => {
  it("normalizes review query maps", () => {
    const reviews = normalizeReviews(
      new Map([
        [
          "doc-1",
          {
            toJSON: () => ({
              $ownerId: "owner-1",
              resourceId: "tokens",
              rating: 4,
              reviewText: "Useful",
              $createdAt: 100,
              $updatedAt: 150,
              $revision: 2,
            }),
          },
        ],
      ]),
    );

    expect(reviews).toEqual([
      {
        id: "doc-1",
        ownerId: "owner-1",
        resourceId: "tokens",
        rating: 4,
        reviewText: "Useful",
        createdAt: 100,
        updatedAt: 150,
        revision: 2,
      },
    ]);
  });

  it("derives count, sum and average from a rating distribution", () => {
    // 2×3 + 5×4 + 8×5 = 6 + 20 + 40 = 66 over 15 reviews → 4.4 avg.
    const summary = summaryFromDistribution("dashnote", {
      1: 0n,
      2: 0n,
      3: 2n,
      4: 5n,
      5: 8n,
    });

    expect(summary).toEqual({
      resourceId: "dashnote",
      count: 15n,
      sum: 66n,
      average: 4.4,
    });
  });

  it("degrades to zeros for an all-zero distribution (no reviews)", () => {
    const summary = summaryFromDistribution("tokens", {
      1: 0n,
      2: 0n,
      3: 0n,
      4: 0n,
      5: 0n,
    });

    expect(summary).toEqual({
      resourceId: "tokens",
      count: 0n,
      sum: 0n,
      average: null,
    });
  });
});

describe("DashRate rating distribution", () => {
  it("encodes a rating as its order-preserving sign-flipped hex key", () => {
    // 0x80 | rating — verified against the live contract's grouped count.
    expect(ratingKeyHex(1)).toBe("81");
    expect(ratingKeyHex(5)).toBe("85");
  });

  it("maps grouped count keys back to ratings, defaulting absent to 0", async () => {
    // Grouped `count` returns one entry per PRESENT rating, keyed by the
    // order-preserving hex key. Ratings with no reviews (1, 2) are absent.
    const countMock = vi.fn().mockResolvedValue(
      new Map([
        [ratingKeyHex(3), 2n],
        [ratingKeyHex(4), 5n],
        [ratingKeyHex(5), 8n],
      ]),
    );
    const sdk = { documents: { count: countMock } } as unknown as DashSdk;

    const distribution = await getRatingDistribution({
      sdk,
      contractId: "contract-1",
      resourceId: "tokens",
      log: () => {},
    });

    expect(distribution).toEqual({ 1: 0n, 2: 0n, 3: 2n, 4: 5n, 5: 8n });

    // Verify the query shape: between-range on rating + groupBy drives
    // the RangeDistinct grouped count, scoped by the resourceId equality.
    expect(countMock).toHaveBeenCalledWith({
      dataContractId: "contract-1",
      documentTypeName: "review",
      where: [
        ["resourceId", "==", "tokens"],
        ["rating", "between", [1, 5]],
      ],
      orderBy: [["rating", "asc"]],
      groupBy: ["rating"],
    });
  });
});

describe("DashRate review list filtering", () => {
  const reviewDoc = (rating: number) => ({
    toJSON: () => ({
      $ownerId: "owner-1",
      resourceId: "dashnote",
      rating,
      reviewText: "",
      $createdAt: 1,
      $updatedAt: 1,
      $revision: 1,
    }),
  });

  it("orders by resourceId when unfiltered (served by [resourceId])", async () => {
    const queryMock = vi.fn().mockResolvedValue([reviewDoc(3), reviewDoc(5)]);
    const sdk = { documents: { query: queryMock } } as unknown as DashSdk;

    await listResourceReviews({
      sdk,
      contractId: "c1",
      resourceId: "dashnote",
      log: () => {},
    });

    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [["resourceId", "==", "dashnote"]],
        orderBy: [["resourceId", "asc"]],
      }),
    );
  });

  it("orders by rating (the trailing index field) when filtered", async () => {
    // orderBy MUST be the index's last property; ordering by resourceId
    // here strips rating from the usable prefix and the query is rejected.
    const queryMock = vi.fn().mockResolvedValue([reviewDoc(5)]);
    const sdk = { documents: { query: queryMock } } as unknown as DashSdk;

    await listResourceReviews({
      sdk,
      contractId: "c1",
      resourceId: "dashnote",
      ratingFilter: 5,
      log: () => {},
    });

    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [
          ["resourceId", "==", "dashnote"],
          ["rating", "==", 5],
        ],
        orderBy: [["rating", "asc"]],
      }),
    );
  });
});
