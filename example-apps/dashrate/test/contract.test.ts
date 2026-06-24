import { describe, expect, it } from "vitest";
import { REVIEW_SCHEMAS } from "../src/dash/contract";

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
