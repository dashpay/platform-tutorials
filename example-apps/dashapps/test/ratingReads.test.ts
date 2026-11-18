import { expect, it, vi } from "vitest";
import {
  listRatings,
  myRatings,
  ownRating,
  ratingAverage,
  ratingAverages,
  ratingRecord,
  ratingSummary,
  starsFromKeyHex,
} from "../src/dash/ratingReads";
import { id, sdk } from "./helpers";

function document(n: number, stars = 5, owner = 1, target = 2) {
  return {
    id: id(n),
    ownerId: id(owner),
    revision: 1n,
    createdAt: BigInt(n),
    properties: {
      contractId: id(target),
      stars,
      title: `Title ${n}`,
      body: `Body ${n}`,
    },
  };
}

it("parses strict rating documents and rejects malformed stars", () => {
  expect(ratingRecord(document(3, 4))).toEqual({
    id: id(3),
    ownerId: id(1),
    contractId: id(2),
    stars: 4,
    title: "Title 3",
    body: "Body 3",
    createdAt: 3n,
    updatedAt: undefined,
    revision: 1n,
  });
  expect(
    ratingRecord({
      ...document(3),
      properties: { ...document(3).properties, stars: 3n },
    }).stars,
  ).toBe(3);
  for (const stars of [0, 6, 2.5, "five", undefined])
    expect(() =>
      ratingRecord({
        ...document(3),
        properties: { ...document(3).properties, stars },
      }),
    ).toThrow("Malformed rating stars.");
  expect(() =>
    ratingRecord({
      ...document(3),
      properties: { ...document(3).properties, title: 7 },
    }),
  ).toThrow("Malformed rating title.");
  expect(() =>
    ratingRecord({
      ...document(3),
      properties: { ...document(3).properties, contractId: "bad" },
    }),
  ).toThrow();
});

it("decodes grouped-count keys as the plain rating byte", () => {
  // Literal network keys, not keys built with the app's own encoder.
  expect(["01", "02", "03", "04", "05"].map(starsFromKeyHex)).toEqual([
    1, 2, 3, 4, 5,
  ]);
  // The old sign-flipped form ("85") must read as unknown.
  for (const key of [
    "81",
    "85",
    "00",
    "06",
    "80",
    "ff",
    "5",
    "0005",
    "zz",
    "",
  ]) {
    expect(starsFromKeyHex(key)).toBeNull();
  }
});

// Testnet contracts and the identifier hex the network keys them by.
const DPNS = "GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec";
const DPNS_HEX =
  "e668c659af66aee1e72c186dde7b5b7e0a1d712a09c40d5721f622bf53c53155";
const DASHPAY = "Bwr4WHCPz5rFVAD87RqTs3izo4zpzwsEdKPWUT1NS1C7";
const DASHPAY_HEX =
  "a2a1b4ac6fef22ea2a1a68e8123644b357875f6b412c18109281c146e7b271bc";
const DASHRATE = "EJHQrRenbFXEPvhgFXD7v8F2ewkqZ2JEdHGKMshZauxz";

it("reads one contract's proven average, zero when it has no ratings", async () => {
  const client = sdk();
  vi.mocked(client.documents.average).mockResolvedValueOnce(
    new Map([["", { count: 2n, sum: 9n }]]),
  );
  expect(await ratingAverage(client, id(9), DPNS)).toEqual({
    count: 2n,
    sum: 9n,
    average: 4.5,
  });
  expect(client.documents.average).toHaveBeenCalledWith(
    {
      dataContractId: id(9),
      documentTypeName: "appReview",
      where: [["contractId", "==", DPNS]],
    },
    "stars",
  );
  // No ratings: an empty map, not a zero entry.
  vi.mocked(client.documents.average).mockResolvedValueOnce(new Map());
  expect(await ratingAverage(client, id(9), DPNS)).toEqual({
    count: 0n,
    sum: 0n,
    average: null,
  });
  vi.mocked(client.documents.average).mockResolvedValueOnce(
    new Map([["", { count: -1n, sum: 0n }]]),
  );
  await expect(ratingAverage(client, id(9), DPNS)).rejects.toThrow(
    "Malformed average response.",
  );
});

it("batches averages per page, converting hex keys and zero-filling unrated contracts", async () => {
  const client = sdk();
  // Network format: hex identifier keys; DashRate has no ratings, so no key.
  vi.mocked(client.documents.average).mockResolvedValue(
    new Map([
      [DPNS_HEX, { count: 2n, sum: 9n }],
      [DASHPAY_HEX, { count: 1n, sum: 3n }],
    ]),
  );
  const averages = await ratingAverages(client, id(9), [
    DASHRATE,
    DPNS,
    DASHPAY,
    DPNS,
  ]);
  expect([...averages]).toEqual([
    [DASHRATE, { count: 0n, sum: 0n, average: null }],
    [DPNS, { count: 2n, sum: 9n, average: 4.5 }],
    [DASHPAY, { count: 1n, sum: 3n, average: 3 }],
  ]);
  expect(client.documents.average).toHaveBeenCalledOnce();
  expect(client.documents.average).toHaveBeenCalledWith(
    {
      dataContractId: id(9),
      documentTypeName: "appReview",
      where: [["contractId", "in", [DASHRATE, DPNS, DASHPAY]]],
      groupBy: ["contractId"],
    },
    "stars",
  );
});

it("splits batched averages into groups of 100 and rejects unexpected keys", async () => {
  const client = sdk();
  const ids = Array.from({ length: 150 }, (_, index) => id(index + 1));
  await ratingAverages(client, id(9), ids);
  const calls = vi.mocked(client.documents.average).mock.calls;
  expect(calls.map(([args]) => (args.where[0][2] as string[]).length)).toEqual([
    100, 50,
  ]);
  // A key for a contract that wasn't asked for, or a base58 key.
  for (const key of [DASHPAY_HEX, DPNS]) {
    vi.mocked(client.documents.average).mockResolvedValueOnce(
      new Map([[key, { count: 1n, sum: 5n }]]),
    );
    await expect(ratingAverages(client, id(9), [DPNS])).rejects.toThrow();
  }
});

it("reads the grouped count with a between range and defaults absent stars to 0", async () => {
  const client = sdk();
  // Network format: plain value bytes.
  vi.mocked(client.documents.count).mockResolvedValue(
    new Map([
      ["03", 2n],
      ["05", 8n],
    ]),
  );
  vi.mocked(client.documents.average).mockResolvedValue(
    new Map([["", { count: 10n, sum: 46n }]]),
  );
  const summary = await ratingSummary(client, id(9), id(2));
  expect(summary.distribution).toEqual({ 1: 0n, 2: 0n, 3: 2n, 4: 0n, 5: 8n });
  // The total and average come from the proven average, not the histogram.
  expect(summary.count).toBe(10n);
  expect(summary.average).toBeCloseTo(4.6);
  expect(client.documents.count).toHaveBeenCalledWith({
    dataContractId: id(9),
    documentTypeName: "appReview",
    where: [
      ["contractId", "==", id(2)],
      ["stars", "between", [1, 5]],
    ],
    orderBy: [["stars", "asc"]],
    groupBy: ["stars"],
  });
});

it("rejects malformed count responses instead of showing zero", async () => {
  const client = sdk();
  vi.mocked(client.documents.count).mockResolvedValue(new Map([["05", -1n]]));
  await expect(ratingSummary(client, id(9), id(2))).rejects.toThrow(
    "Malformed count response.",
  );
  // An unrecognized key means the encoding changed; surface it, don't zero it.
  for (const key of ["06", "85"]) {
    vi.mocked(client.documents.count).mockResolvedValue(new Map([[key, 1n]]));
    await expect(ratingSummary(client, id(9), id(2))).rejects.toThrow(
      "Malformed count response.",
    );
  }
  vi.mocked(client.documents.count).mockResolvedValue(
    [] as unknown as Map<string, bigint>,
  );
  await expect(ratingSummary(client, id(9), id(2))).rejects.toThrow(
    "Malformed count response.",
  );
});

it("asks the serving index for each sort and filter, server-ordered", async () => {
  const client = sdk();
  await listRatings(client, id(9), id(2));
  await listRatings(client, id(9), id(2), { sort: "highest" });
  await listRatings(client, id(9), id(2), { sort: "lowest" });
  // A star filter wins over the sort: newest first on contractStarsRecent.
  await listRatings(client, id(9), id(2), { sort: "highest", stars: 3 });
  await listRatings(client, id(9), id(2), { cursor: id(40), limit: 10 });
  expect(
    vi.mocked(client.documents.query).mock.calls.map(([args]) => args),
  ).toEqual([
    {
      dataContractId: id(9),
      documentTypeName: "appReview",
      where: [["contractId", "==", id(2)]],
      orderBy: [["$updatedAt", "desc"]],
      limit: 26,
    },
    {
      dataContractId: id(9),
      documentTypeName: "appReview",
      where: [["contractId", "==", id(2)]],
      orderBy: [
        ["stars", "desc"],
        ["$updatedAt", "desc"],
      ],
      limit: 26,
    },
    {
      dataContractId: id(9),
      documentTypeName: "appReview",
      where: [["contractId", "==", id(2)]],
      orderBy: [
        ["stars", "asc"],
        ["$updatedAt", "desc"],
      ],
      limit: 26,
    },
    {
      dataContractId: id(9),
      documentTypeName: "appReview",
      where: [
        ["contractId", "==", id(2)],
        ["stars", "==", 3],
      ],
      orderBy: [["$updatedAt", "desc"]],
      limit: 26,
    },
    {
      dataContractId: id(9),
      documentTypeName: "appReview",
      where: [["contractId", "==", id(2)]],
      orderBy: [["$updatedAt", "desc"]],
      limit: 11,
      startAfter: id(40),
    },
  ]);
  await expect(
    listRatings(client, id(9), id(2), { stars: 6 as never }),
  ).rejects.toThrow("Choose 1 to 5 stars.");
});

it("returns rows in the order the SDK gave them, never re-sorted", async () => {
  // An order no local sort produces, so any client re-sort fails.
  const rows = [
    document(20, 4),
    document(31, 5),
    document(12, 1),
    document(27, 3),
  ];
  const order = [id(20), id(31), id(12), id(27)];
  for (const sort of ["recent", "highest", "lowest"] as const) {
    const client = sdk();
    vi.mocked(client.documents.query).mockResolvedValue(rows);
    const page = await listRatings(client, id(9), id(2), { sort });
    expect(page.ratings.map((rating) => rating.id)).toEqual(order);
    expect(page.cursor).toBeUndefined();
  }
});

it("pages with limit + 1: the extra row only signals another page", async () => {
  const client = sdk();
  // Map-shaped results, as the SDK returns them.
  const asMap = (rows: ReturnType<typeof document>[]) =>
    new Map(rows.map((row) => [row.id, row]));
  vi.mocked(client.documents.query)
    .mockResolvedValueOnce(asMap([document(50), document(41), document(47)]))
    .mockResolvedValueOnce(asMap([document(47), document(33)]));
  const first = await listRatings(client, id(9), id(2), { limit: 2 });
  expect(first.ratings.map((rating) => rating.id)).toEqual([id(50), id(41)]);
  // The cursor is the last row SHOWN, so the extra row leads page 2.
  expect(first.cursor).toBe(id(41));
  const second = await listRatings(client, id(9), id(2), {
    limit: 2,
    cursor: first.cursor,
  });
  expect(client.documents.query).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ limit: 3, startAfter: id(41) }),
  );
  expect(second.ratings.map((rating) => rating.id)).toEqual([id(47), id(33)]);
  expect(second.cursor).toBeUndefined();
});

it("skips malformed rows but still advances the cursor past them", async () => {
  const client = sdk();
  const bad = {
    ...document(13),
    properties: { ...document(13).properties, stars: 9 },
  };
  vi.mocked(client.documents.query).mockResolvedValue([
    document(15),
    bad,
    document(11),
  ]);
  const page = await listRatings(client, id(9), id(2), { limit: 2 });
  expect(page.ratings.map((rating) => rating.id)).toEqual([id(15)]);
  expect(page.cursor).toBe(id(13));
});

it("rejects a cursor that does not advance", async () => {
  const client = sdk();
  vi.mocked(client.documents.query).mockResolvedValue([
    document(30),
    document(31),
  ]);
  await expect(
    listRatings(client, id(9), id(2), { limit: 1, cursor: id(30) }),
  ).rejects.toThrow("did not advance");
});

it("looks up the caller's own rating through the unique owner index", async () => {
  const client = sdk();
  vi.mocked(client.documents.query).mockResolvedValue([document(3)]);
  expect(await ownRating(client, id(9), id(1), id(2))).toMatchObject({
    id: id(3),
  });
  expect(client.documents.query).toHaveBeenCalledWith({
    dataContractId: id(9),
    documentTypeName: "appReview",
    where: [
      ["$ownerId", "==", id(1)],
      ["contractId", "==", id(2)],
    ],
    orderBy: [
      ["$ownerId", "asc"],
      ["contractId", "asc"],
    ],
    limit: 1,
  });
  vi.mocked(client.documents.query).mockResolvedValue([]);
  expect(await ownRating(client, id(9), id(1), id(2))).toBeNull();
});

it("pages the caller's ratings newest first through ownerRecent", async () => {
  const client = sdk();
  vi.mocked(client.documents.query).mockResolvedValue([
    document(8, 2, 1, 5),
    document(30, 5, 1, 6),
    document(4, 3, 1, 7),
  ]);
  const page = await myRatings(client, id(9), id(1), id(60), 2);
  expect(page.ratings.map((rating) => rating.id)).toEqual([id(8), id(30)]);
  expect(page.cursor).toBe(id(30));
  expect(client.documents.query).toHaveBeenCalledWith({
    dataContractId: id(9),
    documentTypeName: "appReview",
    where: [["$ownerId", "==", id(1)]],
    orderBy: [["$updatedAt", "desc"]],
    limit: 3,
    startAfter: id(60),
  });
});
