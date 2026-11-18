import { describe, expect, it, vi } from "vitest";
import {
  findMyReviewForResource,
  getRatingDistribution,
  getRatingSummary,
  listMyReviews,
  listResourceReviews,
  normalizeReviews,
  normalizeSingleReview,
  ratingFromKeyHex,
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

  it("normalizes an array of documents, taking ids from $id", () => {
    const reviews = normalizeReviews([
      { toJSON: () => ({ $id: "doc-a", $ownerId: "o", rating: 5 }) },
      { toJSON: () => ({ $id: "doc-b", $ownerId: "o", rating: 1 }) },
    ]);

    expect(reviews.map((review) => review.id)).toEqual(["doc-a", "doc-b"]);
    expect(reviews.map((review) => review.rating)).toEqual([5, 1]);
  });

  it("normalizes a plain-object map keyed by document id", () => {
    const reviews = normalizeReviews({
      "doc-1": { toJSON: () => ({ $ownerId: "owner-1", rating: 3 }) },
    });

    expect(reviews).toEqual([
      {
        id: "doc-1",
        ownerId: "owner-1",
        resourceId: "",
        rating: 3,
        reviewText: "",
        createdAt: null,
        updatedAt: null,
        revision: 0,
      },
    ]);
  });

  it("skips null/undefined documents in any shape", () => {
    expect(
      normalizeReviews([
        null as never,
        { toJSON: () => ({ $id: "doc-a", rating: 4 }) },
      ]),
    ).toHaveLength(1);
    expect(
      normalizeReviews({
        empty: undefined,
        "doc-b": { toJSON: () => ({ rating: 2 }) },
      }),
    ).toHaveLength(1);
  });

  it("normalizes (or rejects) a single review", () => {
    expect(normalizeSingleReview("doc-1", undefined)).toBeNull();
    const review = normalizeSingleReview("doc-1", {
      toJSON: () => ({ $ownerId: "owner-1", rating: 5 }),
    });
    expect(review).toMatchObject({
      id: "doc-1",
      ownerId: "owner-1",
      rating: 5,
    });
  });
});

describe("DashRate rating distribution", () => {
  it("decodes plain-byte rating keys", () => {
    // Literal keys as returned by testnet.
    expect(ratingFromKeyHex("01")).toBe(1);
    expect(ratingFromKeyHex("05")).toBe(5);
  });

  it("rejects keys that aren't a 1–5 rating", () => {
    // Includes sign-flipped bytes ("81", "85"): not this encoding.
    for (const key of ["", "00", "06", "80", "81", "85", "0005", "zz"]) {
      expect(ratingFromKeyHex(key)).toBeNull();
    }
  });

  it("maps grouped count keys back to ratings, defaulting absent to 0", async () => {
    // Grouped `count` returns one entry per PRESENT rating, keyed by the
    // hex index key. Ratings with no reviews (1, 2) are absent. Literal
    // PV14 keys, not built with app code, so an encoding change shows up.
    const countMock = vi.fn().mockResolvedValue(
      new Map([
        ["03", 2n],
        ["04", 5n],
        ["05", 8n],
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

  it("logs and skips unexpected keys", async () => {
    const countMock = vi.fn().mockResolvedValue(
      new Map([
        ["01", 1n],
        ["85", 3n],
        ["ff", 9n],
      ]),
    );
    const sdk = { documents: { count: countMock } } as unknown as DashSdk;
    const log = vi.fn();

    const distribution = await getRatingDistribution({
      sdk,
      contractId: "contract-1",
      resourceId: "tokens",
      log,
    });

    expect(distribution).toEqual({ 1: 1n, 2: 0n, 3: 0n, 4: 0n, 5: 0n });
    expect(log).toHaveBeenCalledWith(
      'Unexpected rating key "85" for tokens',
      "error",
    );
    expect(log).toHaveBeenCalledWith(
      'Unexpected rating key "ff" for tokens',
      "error",
    );
  });
});

describe("DashRate review list paging", () => {
  // Literal network-format docs: a Map in server (index-walk) order.
  const doc = (id: string, rating: number, updatedAt: number) =>
    [
      id,
      {
        toJSON: () => ({
          $id: id,
          $ownerId: "owner-1",
          resourceId: "dashnote",
          rating,
          $createdAt: updatedAt,
          $updatedAt: updatedAt,
          $revision: 1,
        }),
      },
    ] as const;

  it("asks for newest first and cursors on the last shown row", async () => {
    // limit 2 → asks for 3; the third only signals that a next page exists.
    const queryMock = vi
      .fn()
      .mockResolvedValue(
        new Map([
          doc("6dpRo199kmSs4XB5ruPoB9rccpqnvrvMoYcyaaqWA11i", 3, 1794866785068),
          doc("24ed92ePXVA9ztDrBwzhnhgXQcGbReBQL9jWGkjW9F7n", 4, 1794866776173),
          doc("Gjke5QGEJgwFpwuMFM5q3PhQG5FR7zCvs7UEXCvcZVHU", 5, 1794866760270),
        ]),
      );
    const sdk = { documents: { query: queryMock } } as unknown as DashSdk;

    const page = await listResourceReviews({
      sdk,
      contractId: "c1",
      resourceId: "dashnote",
      limit: 2,
      log: () => {},
    });

    expect(queryMock).toHaveBeenCalledWith({
      dataContractId: "c1",
      documentTypeName: "review",
      where: [["resourceId", "==", "dashnote"]],
      orderBy: [["$updatedAt", "desc"]],
      limit: 3,
    });
    expect(page.reviews.map((review) => review.updatedAt)).toEqual([
      1794866785068, 1794866776173,
    ]);
    // More than `limit` came back → the last SHOWN ID is the next cursor.
    expect(page.nextCursor).toBe(
      "24ed92ePXVA9ztDrBwzhnhgXQcGbReBQL9jWGkjW9F7n",
    );
  });

  it("returns rows in the order the SDK gave them, never re-sorted", async () => {
    // Deliberately an order no local sort produces: timestamps not
    // monotonic, IDs not alphabetical, ratings not sorted. Only a
    // pass-through of the server's index-walk order matches.
    const queryMock = vi
      .fn()
      .mockResolvedValue(
        new Map([
          doc("Mid", 4, 200),
          doc("Zed", 5, 300),
          doc("Abe", 3, 100),
          doc("Kay", 1, 300),
        ]),
      );
    const sdk = { documents: { query: queryMock } } as unknown as DashSdk;

    const page = await listResourceReviews({
      sdk,
      contractId: "c1",
      resourceId: "dashnote",
      limit: 10,
      log: () => {},
    });

    expect(page.reviews.map((review) => review.id)).toEqual([
      "Mid",
      "Zed",
      "Abe",
      "Kay",
    ]);
  });

  it("passes the cursor as startAfter and ends on a short page", async () => {
    const queryMock = vi
      .fn()
      .mockResolvedValue(
        new Map([
          doc("Gjke5QGEJgwFpwuMFM5q3PhQG5FR7zCvs7UEXCvcZVHU", 5, 1794866760270),
        ]),
      );
    const sdk = { documents: { query: queryMock } } as unknown as DashSdk;

    const page = await listResourceReviews({
      sdk,
      contractId: "c1",
      resourceId: "dashnote",
      startAfter: "24ed92ePXVA9ztDrBwzhnhgXQcGbReBQL9jWGkjW9F7n",
      limit: 2,
      log: () => {},
    });

    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        startAfter: "24ed92ePXVA9ztDrBwzhnhgXQcGbReBQL9jWGkjW9F7n",
      }),
    );
    expect(page.reviews).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it("ends without a cursor when the total is an exact multiple", async () => {
    // Exactly `limit` rows: no extra row, so no "Load more" onto an empty page.
    const queryMock = vi
      .fn()
      .mockResolvedValue(
        new Map([
          doc("5cCJnbvJdQBJrYpT2xc3Uf2Ju7WzbZnVjCn7s4dzdKfx", 2, 1794866767244),
          doc("3dUELkAhDrXS7sFUcQ53WJ6ZUUkQgzfhm9PC7JNRay3m", 3, 1794866766000),
        ]),
      );
    const sdk = { documents: { query: queryMock } } as unknown as DashSdk;

    const page = await listResourceReviews({
      sdk,
      contractId: "c1",
      resourceId: "tokens",
      limit: 2,
      log: () => {},
    });

    expect(page.reviews).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });

  it("filters by rating server-side, still newest first", async () => {
    // [resourceId, rating, $updatedAt] serves this; $updatedAt is its
    // trailing property, so orderBy stays $updatedAt.
    const queryMock = vi.fn().mockResolvedValue(new Map());
    const sdk = { documents: { query: queryMock } } as unknown as DashSdk;

    const page = await listResourceReviews({
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
        orderBy: [["$updatedAt", "desc"]],
        limit: 11,
      }),
    );
    expect(page).toEqual({ reviews: [], nextCursor: null });
  });
});

describe("DashRate getRatingSummary", () => {
  it("reads count and sum from the ungrouped average map", async () => {
    // Literal testnet shape: Map(1) { '' => { count: 3n, sum: 11n } }.
    const averageMock = vi
      .fn()
      .mockResolvedValue(new Map([["", { count: 3n, sum: 11n }]]));
    const sdk = { documents: { average: averageMock } } as unknown as DashSdk;

    const summary = await getRatingSummary({
      sdk,
      contractId: "c1",
      resourceId: "dashnote",
      log: () => {},
    });

    expect(summary).toEqual({
      resourceId: "dashnote",
      count: 3n,
      sum: 11n,
      average: 11 / 3,
    });
    expect(averageMock).toHaveBeenCalledWith(
      {
        dataContractId: "c1",
        documentTypeName: "review",
        where: [["resourceId", "==", "dashnote"]],
        orderBy: [["resourceId", "asc"]],
      },
      "rating",
    );
  });

  it("treats the empty map (no reviews) as zero", async () => {
    // A resource with no reviews returns Map(0), NOT '' => {0n, 0n}.
    const averageMock = vi.fn().mockResolvedValue(new Map());
    const sdk = { documents: { average: averageMock } } as unknown as DashSdk;

    expect(
      await getRatingSummary({
        sdk,
        contractId: "c1",
        resourceId: "intro",
        log: () => {},
      }),
    ).toEqual({ resourceId: "intro", count: 0n, sum: 0n, average: null });
  });

  it("logs and rethrows a failed query", async () => {
    const averageMock = vi.fn().mockRejectedValue(new Error("boom"));
    const sdk = { documents: { average: averageMock } } as unknown as DashSdk;
    const log = vi.fn();

    await expect(
      getRatingSummary({ sdk, contractId: "c1", resourceId: "intro", log }),
    ).rejects.toThrow("boom");
    expect(log).toHaveBeenCalledWith(
      "Average query failed for intro: boom",
      "error",
    );
  });
});

describe("DashRate listMyReviews", () => {
  const reviewDoc = (updatedAt: number) => ({
    toJSON: () => ({
      $ownerId: "owner-1",
      resourceId: "tokens",
      rating: 4,
      reviewText: "",
      $createdAt: 1,
      $updatedAt: updatedAt,
      $revision: 1,
    }),
  });

  it("queries by owner newest first", async () => {
    const queryMock = vi
      .fn()
      .mockResolvedValue([reviewDoc(300), reviewDoc(200), reviewDoc(100)]);
    const sdk = { documents: { query: queryMock } } as unknown as DashSdk;

    const reviews = await listMyReviews({
      sdk,
      contractId: "c1",
      ownerId: "owner-1",
      log: () => {},
    });

    expect(reviews.map((review) => review.updatedAt)).toEqual([300, 200, 100]);
    expect(queryMock).toHaveBeenCalledWith({
      dataContractId: "c1",
      documentTypeName: "review",
      where: [["$ownerId", "==", "owner-1"]],
      orderBy: [["$updatedAt", "desc"]],
      limit: 50,
    });
  });
  it("returns reviews in the order the SDK gave them, never re-sorted", async () => {
    // Timestamps deliberately out of order: a local sort would reorder them.
    const queryMock = vi
      .fn()
      .mockResolvedValue([reviewDoc(200), reviewDoc(300), reviewDoc(100)]);
    const sdk = { documents: { query: queryMock } } as unknown as DashSdk;

    const reviews = await listMyReviews({
      sdk,
      contractId: "c1",
      ownerId: "owner-1",
      log: () => {},
    });

    expect(reviews.map((review) => review.updatedAt)).toEqual([200, 300, 100]);
  });
});

describe("DashRate findMyReviewForResource", () => {
  const reviewDoc = {
    toJSON: () => ({
      $id: "doc-1",
      $ownerId: "owner-1",
      resourceId: "tokens",
      rating: 4,
      reviewText: "",
      $createdAt: 1,
      $updatedAt: 1,
      $revision: 1,
    }),
  };

  it("queries by owner+resource with limit 1 and returns the match", async () => {
    // saveReview relies on this to decide create vs. update.
    const queryMock = vi.fn().mockResolvedValue([reviewDoc]);
    const sdk = { documents: { query: queryMock } } as unknown as DashSdk;

    const review = await findMyReviewForResource({
      sdk,
      contractId: "c1",
      resourceId: "tokens",
      ownerId: "owner-1",
    });

    expect(review?.id).toBe("doc-1");
    expect(queryMock).toHaveBeenCalledWith({
      dataContractId: "c1",
      documentTypeName: "review",
      where: [
        ["$ownerId", "==", "owner-1"],
        ["resourceId", "==", "tokens"],
      ],
      orderBy: [
        ["$ownerId", "asc"],
        ["resourceId", "asc"],
      ],
      limit: 1,
    });
  });

  it("returns null when no review exists for the pair", async () => {
    const queryMock = vi.fn().mockResolvedValue([]);
    const sdk = { documents: { query: queryMock } } as unknown as DashSdk;

    expect(
      await findMyReviewForResource({
        sdk,
        contractId: "c1",
        resourceId: "tokens",
        ownerId: "owner-1",
      }),
    ).toBeNull();
  });
});
