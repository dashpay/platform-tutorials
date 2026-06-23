import { describe, expect, it } from "vitest";
import { normalizeHistory } from "../src/dash/history";

describe("DashRate history normalization", () => {
  it("sorts timestamp-keyed review history newest first", () => {
    const history = normalizeHistory(
      new Map([
        [
          1000n,
          {
            revision: 1,
            toJSON: () => ({ rating: 3, reviewText: "Initial" }),
          },
        ],
        [
          2000n,
          {
            revision: 2,
            toJSON: () => ({ rating: 5, reviewText: "Updated" }),
          },
        ],
      ]),
    );

    expect(history).toEqual([
      {
        blockTimeMs: 2000,
        revision: 2,
        rating: 5,
        reviewText: "Updated",
      },
      {
        blockTimeMs: 1000,
        revision: 1,
        rating: 3,
        reviewText: "Initial",
      },
    ]);
  });
});
