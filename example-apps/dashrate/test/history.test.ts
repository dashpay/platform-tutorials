import { describe, expect, it, vi } from "vitest";
import {
  REVIEW_HISTORY_LIMIT,
  fetchReviewHistory,
  normalizeHistory,
} from "../src/dash/history";
import type { DashSdk } from "../src/dash/types";

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

describe("fetchReviewHistory limit clamp", () => {
  function sdkCapturingLimit() {
    const historyMock = vi.fn().mockResolvedValue(new Map());
    const sdk = { documents: { history: historyMock } } as unknown as DashSdk;
    return { sdk, historyMock };
  }

  it("clamps an oversized limit down to REVIEW_HISTORY_LIMIT", async () => {
    const { sdk, historyMock } = sdkCapturingLimit();
    await fetchReviewHistory({
      sdk,
      contractId: "c1",
      reviewId: "doc-1",
      limit: 999,
    });
    expect(historyMock.mock.calls[0][0].limit).toBe(REVIEW_HISTORY_LIMIT);
  });

  it.each([0, -1, -100])(
    "clamps a non-positive limit %p up to 1",
    async (limit) => {
      const { sdk, historyMock } = sdkCapturingLimit();
      await fetchReviewHistory({
        sdk,
        contractId: "c1",
        reviewId: "doc-1",
        limit,
      });
      expect(historyMock.mock.calls[0][0].limit).toBe(1);
    },
  );

  it("passes an in-range limit through unchanged", async () => {
    const { sdk, historyMock } = sdkCapturingLimit();
    await fetchReviewHistory({
      sdk,
      contractId: "c1",
      reviewId: "doc-1",
      limit: 5,
    });
    expect(historyMock.mock.calls[0][0].limit).toBe(5);
  });

  it("forwards the full history query shape (contract, type, id, startAtMs)", async () => {
    const { sdk, historyMock } = sdkCapturingLimit();
    await fetchReviewHistory({
      sdk,
      contractId: "c1",
      reviewId: "doc-1",
      startAtMs: 1234,
      limit: 5,
    });
    expect(historyMock).toHaveBeenCalledWith({
      dataContractId: "c1",
      documentTypeName: "review",
      documentId: "doc-1",
      startAtMs: 1234,
      limit: 5,
    });
  });

  it("defaults startAtMs to 0 when omitted", async () => {
    const { sdk, historyMock } = sdkCapturingLimit();
    await fetchReviewHistory({ sdk, contractId: "c1", reviewId: "doc-1" });
    expect(historyMock.mock.calls[0][0].startAtMs).toBe(0);
  });
});
