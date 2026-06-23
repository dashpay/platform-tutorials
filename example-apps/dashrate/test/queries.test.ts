import { describe, expect, it } from "vitest";
import {
  normalizeReviews,
  summaryFromAggregateMaps,
} from "../src/dash/queries";

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

  it("derives average from v4 aggregate maps", () => {
    const summary = summaryFromAggregateMaps({
      resourceId: "dashnote",
      countMap: new Map([["dashnote", 3n]]),
      sumMap: new Map([["dashnote", 12n]]),
      averageMap: new Map([["dashnote", { count: 3n, sum: 12n }]]),
    });

    expect(summary).toEqual({
      resourceId: "dashnote",
      count: 3n,
      sum: 12n,
      average: 4,
    });
  });
});
