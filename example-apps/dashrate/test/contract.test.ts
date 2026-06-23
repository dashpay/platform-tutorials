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
    expect(
      REVIEW_SCHEMAS.review.indices.find(
        (index) => index.name === "resourceRatingAggregate",
      ),
    ).toMatchObject({
      properties: [{ resourceId: "asc" }],
      countable: "countable",
      summable: "rating",
    });
  });
});
