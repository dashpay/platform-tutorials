import { expect, it, vi } from "vitest";
import { highlyRated, leaderboard, rankedNames } from "../src/dash/leaderboard";
import type { GroupedResult } from "../src/dash/types";
import { id, sdk } from "./helpers";

const DPNS = "GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec";
const DASHPAY = "Bwr4WHCPz5rFVAD87RqTs3izo4zpzwsEdKPWUT1NS1C7";
const DASHRATE = "EJHQrRenbFXEPvhgFXD7v8F2ewkqZ2JEdHGKMshZauxz";

// Literal testnet results: groupValue arrives base58, averages are
// fixed-point at valueScale 1e19.
const RANKED_AVG: GroupedResult = {
  startingRank: 0n,
  entries: [
    {
      groupKeyHex:
        "e668c659af66aee1e72c186dde7b5b7e0a1d712a09c40d5721f622bf53c53155",
      groupValue: DPNS,
      value: 45000000000000000000n,
      valueAsNumber: 4.5,
      rank: 0n,
    },
    {
      groupKeyHex:
        "a2a1b4ac6fef22ea2a1a68e8123644b357875f6b412c18109281c146e7b271bc",
      groupValue: DASHPAY,
      value: 30000000000000000000n,
      valueAsNumber: 3,
      rank: 1n,
    },
    {
      groupKeyHex:
        "c5955c2c372fe84686f8c28f5de24f55909b0891f1f1defc29bea4e22e29cca7",
      groupValue: DASHRATE,
      value: 20000000000000000000n,
      valueAsNumber: 2,
      rank: 2n,
    },
  ],
  valueScale: 10000000000000000000n,
};

// Count ties come back in no meaningful order: DashRate before DashPay.
const RANKED_COUNT: GroupedResult = {
  startingRank: 0n,
  entries: [
    { ...RANKED_AVG.entries[0], value: 2n, valueAsNumber: 2, rank: 0n },
    { ...RANKED_AVG.entries[2], value: 1n, valueAsNumber: 1, rank: 1n },
    { ...RANKED_AVG.entries[1], value: 1n, valueAsNumber: 1, rank: 2n },
  ],
  valueScale: 1n,
};

it("ranks contracts by average and by count in server order", async () => {
  const client = sdk();
  vi.mocked(client.documents.ranked)
    .mockResolvedValueOnce(RANKED_AVG)
    .mockResolvedValueOnce(RANKED_COUNT);
  expect(await leaderboard(client, id(9), "avg")).toEqual([
    { contractId: DPNS, value: 4.5, rank: 0 },
    { contractId: DASHPAY, value: 3, rank: 1 },
    { contractId: DASHRATE, value: 2, rank: 2 },
  ]);
  expect(
    (await leaderboard(client, id(9), "count")).map((row) => row.contractId),
  ).toEqual([DPNS, DASHRATE, DASHPAY]);
  expect(vi.mocked(client.documents.ranked).mock.calls.map(([a]) => a)).toEqual(
    [
      {
        dataContractId: id(9),
        documentTypeName: "appReview",
        groupBy: "contractId",
        aggregate: { type: "avg", property: "stars" },
        direction: "desc",
        limit: 10,
      },
      {
        dataContractId: id(9),
        documentTypeName: "appReview",
        groupBy: "contractId",
        aggregate: { type: "count" },
        direction: "desc",
        limit: 10,
      },
    ],
  );
});

it("pages a ranking with offset; past the end is an empty page", async () => {
  const client = sdk();
  vi.mocked(client.documents.ranked).mockResolvedValueOnce({
    startingRank: 3n,
    entries: [],
    valueScale: 10000000000000000000n,
  });
  expect(
    await leaderboard(client, id(9), "avg", { limit: 1, offset: 3 }),
  ).toEqual([]);
  expect(client.documents.ranked).toHaveBeenCalledWith(
    expect.objectContaining({ limit: 1, offset: 3 }),
  );
});

it("finds every contract averaging 4 stars or more with having", async () => {
  const client = sdk();
  vi.mocked(client.documents.having).mockResolvedValue({
    entries: [{ ...RANKED_AVG.entries[0], rank: undefined }],
    valueScale: 10000000000000000000n,
  });
  expect(await highlyRated(client, id(9))).toEqual([
    { contractId: DPNS, value: 4.5 },
  ]);
  expect(client.documents.having).toHaveBeenCalledWith({
    dataContractId: id(9),
    documentTypeName: "appReview",
    groupBy: "contractId",
    aggregate: { type: "avg", property: "stars" },
    having: { operator: ">=", value: 4 },
    direction: "desc",
    limit: 100,
  });
});

it("rejects a group value that is not an identifier", async () => {
  const client = sdk();
  vi.mocked(client.documents.ranked).mockResolvedValue({
    ...RANKED_AVG,
    entries: [{ ...RANKED_AVG.entries[0], groupValue: undefined }],
  });
  await expect(leaderboard(client, id(9), "avg")).rejects.toThrow();
});

it("names ranked rows by official entry, else the newest community entry", async () => {
  const client = sdk();
  const entry = (n: number, owner: string, contractId: string) => ({
    id: id(n),
    ownerId: owner,
    properties: {
      contractId,
      name: `Name ${n}`,
      tagline: "Tagline",
      category: "other",
    },
  });
  vi.mocked(client.documents.query).mockImplementation(async (args) => {
    if (args.documentTypeName === "appEndorsement")
      return [
        {
          id: id(70),
          ownerId: id(1),
          properties: { contractId: DPNS, publisherId: id(5) },
        },
      ];
    const contract = args.where.find(([field]) => field === "contractId")![2];
    if (args.where[0][0] === "$ownerId") return [entry(11, id(5), DPNS)];
    if (contract === DASHPAY) return [entry(12, id(6), DASHPAY)];
    return [];
  });
  const names = await rankedNames(client, id(9), [DPNS, DASHPAY, DASHRATE]);
  expect(
    [...names].map(([key, value]) => [key, value.name, value.official]),
  ).toEqual([
    [DPNS, "Name 11", true],
    [DASHPAY, "Name 12", false],
  ]);
  expect(client.documents.query).toHaveBeenCalledWith(
    expect.objectContaining({
      documentTypeName: "appEndorsement",
      where: [["contractId", "in", [DPNS, DASHPAY, DASHRATE]]],
    }),
  );
  expect(client.documents.query).toHaveBeenCalledWith({
    dataContractId: id(9),
    documentTypeName: "appMetadata",
    where: [["contractId", "==", DASHPAY]],
    orderBy: [["$updatedAt", "desc"]],
    limit: 2,
  });
});
