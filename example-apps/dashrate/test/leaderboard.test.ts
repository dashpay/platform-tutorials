import { describe, expect, it, vi } from "vitest";
import {
  getLeaderboard,
  getResourcesWithMinAverage,
  MAX_RANKED_LIMIT,
} from "../src/dash/leaderboard";
import type { DashGroupedResult, DashSdk } from "../src/dash/types";

const CATALOG = [
  "intro",
  "tokens",
  "dashnote",
  "dashmint-lab",
  "dashproof-lab",
];

// Literal testnet shapes (protocol v14). Avg values are fixed-point at
// valueScale 1e19 and TRUNCATED: 11/3 → 36666666666666666666n.
const RANKED_AVG: DashGroupedResult = {
  startingRank: 0n,
  entries: [
    {
      groupKeyHex: "6461736870726f6f662d6c6162",
      groupValue: "dashproof-lab",
      value: 50000000000000000000n,
      valueAsNumber: 5,
      rank: 0n,
    },
    {
      groupKeyHex: "646173686d696e742d6c6162",
      groupValue: "dashmint-lab",
      value: 40000000000000000000n,
      valueAsNumber: 4,
      rank: 1n,
    },
    {
      groupKeyHex: "646173686e6f7465",
      groupValue: "dashnote",
      value: 36666666666666666666n,
      valueAsNumber: 3.666666666666667,
      rank: 2n,
    },
    {
      // A resourceId outside the app's catalog — anyone can rate any string.
      groupKeyHex: "756e6c6973746564",
      groupValue: "unlisted",
      value: 30000000000000000000n,
      valueAsNumber: 3,
      rank: 3n,
    },
    {
      groupKeyHex: "746f6b656e73",
      groupValue: "tokens",
      value: 25000000000000000000n,
      valueAsNumber: 2.5,
      rank: 4n,
    },
  ],
  aggregate: "avg",
  groupBy: "resourceId",
  valueScale: 10000000000000000000n,
};

const RANKED_COUNT: DashGroupedResult = {
  startingRank: 0n,
  entries: [
    {
      groupKeyHex: "646173686e6f7465",
      groupValue: "dashnote",
      value: 3n,
      valueAsNumber: 3,
      rank: 0n,
    },
    {
      groupKeyHex: "746f6b656e73",
      groupValue: "tokens",
      value: 2n,
      valueAsNumber: 2,
      rank: 1n,
    },
  ],
  aggregate: "count",
  groupBy: "resourceId",
  valueScale: 1n,
};

const HAVING_AVG_GTE_4: DashGroupedResult = {
  entries: [
    {
      groupKeyHex: "6461736870726f6f662d6c6162",
      groupValue: "dashproof-lab",
      value: 50000000000000000000n,
      valueAsNumber: 5,
    },
    {
      groupKeyHex: "646173686d696e742d6c6162",
      groupValue: "dashmint-lab",
      value: 40000000000000000000n,
      valueAsNumber: 4,
    },
  ],
  aggregate: "avg",
  groupBy: "resourceId",
  valueScale: 10000000000000000000n,
};

describe("getLeaderboard", () => {
  it("ranks by average, best first, keeping only catalog resources", async () => {
    const ranked = vi.fn().mockResolvedValue(RANKED_AVG);
    const sdk = { documents: { ranked } } as unknown as DashSdk;

    const entries = await getLeaderboard({
      sdk,
      contractId: "c1",
      metric: "avg",
      resourceIds: CATALOG,
    });

    expect(ranked).toHaveBeenCalledWith({
      dataContractId: "c1",
      documentTypeName: "review",
      groupBy: "resourceId",
      aggregate: { type: "avg", property: "rating" },
      direction: "desc",
      limit: MAX_RANKED_LIMIT,
    });
    expect(entries).toEqual([
      { resourceId: "dashproof-lab", value: 5 },
      { resourceId: "dashmint-lab", value: 4 },
      { resourceId: "dashnote", value: 3.666666666666667 },
      { resourceId: "tokens", value: 2.5 },
    ]);
  });

  it("ranks by count on the count axis", async () => {
    const ranked = vi.fn().mockResolvedValue(RANKED_COUNT);
    const sdk = { documents: { ranked } } as unknown as DashSdk;

    const entries = await getLeaderboard({
      sdk,
      contractId: "c1",
      metric: "count",
      resourceIds: CATALOG,
    });

    expect(ranked).toHaveBeenCalledWith(
      expect.objectContaining({ aggregate: { type: "count" }, limit: 100 }),
    );
    expect(entries).toEqual([
      { resourceId: "dashnote", value: 3 },
      { resourceId: "tokens", value: 2 },
    ]);
  });
});

describe("getResourcesWithMinAverage", () => {
  it("issues an unscaled, inclusive avg >= bound", async () => {
    const having = vi.fn().mockResolvedValue(HAVING_AVG_GTE_4);
    const sdk = { documents: { having } } as unknown as DashSdk;

    const entries = await getResourcesWithMinAverage({
      sdk,
      contractId: "c1",
      minAverage: 4,
      resourceIds: CATALOG,
    });

    expect(having).toHaveBeenCalledWith({
      dataContractId: "c1",
      documentTypeName: "review",
      groupBy: "resourceId",
      aggregate: { type: "avg", property: "rating" },
      // Natural domain: 4, not 4 × valueScale.
      having: { operator: ">=", value: 4 },
      direction: "desc",
      limit: MAX_RANKED_LIMIT,
    });
    expect(entries.map((entry) => entry.resourceId)).toEqual([
      "dashproof-lab",
      "dashmint-lab",
    ]);
  });
});
