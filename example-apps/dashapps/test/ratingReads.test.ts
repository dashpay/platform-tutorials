import { expect, it, vi } from "vitest";
import {
  listRatings,
  ownRating,
  ratingRecord,
  ratingSummary,
  starsFromKeyHex,
  summarize,
  emptyDistribution,
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

it("derives total and average from the distribution", () => {
  // 2×3 + 5×4 + 8×5 = 66 over 15 → 4.4
  const summary = summarize({ 1: 0n, 2: 0n, 3: 2n, 4: 5n, 5: 8n });
  expect(summary.count).toBe(15n);
  expect(summary.average).toBeCloseTo(4.4);
  expect(summarize(emptyDistribution())).toEqual({
    count: 0n,
    average: null,
    distribution: emptyDistribution(),
  });
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
  const summary = await ratingSummary(client, id(9), id(2));
  expect(summary.distribution).toEqual({ 1: 0n, 2: 0n, 3: 2n, 4: 0n, 5: 8n });
  expect(summary.count).toBe(10n);
  expect(summary.average).toBeCloseTo(4.6);
  expect(client.documents.count).toHaveBeenCalledWith({
    dataContractId: id(9),
    documentTypeName: "appRating",
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
  // A star filter wins over the sort: `stars ==` on byContractStars.
  await listRatings(client, id(9), id(2), { sort: "highest", stars: 3 });
  await listRatings(client, id(9), id(2), { cursor: id(40), limit: 10 });
  expect(
    vi.mocked(client.documents.query).mock.calls.map(([args]) => args),
  ).toEqual([
    {
      dataContractId: id(9),
      documentTypeName: "appRating",
      where: [["contractId", "==", id(2)]],
      orderBy: [["$createdAt", "desc"]],
      limit: 26,
    },
    {
      dataContractId: id(9),
      documentTypeName: "appRating",
      where: [["contractId", "==", id(2)]],
      orderBy: [["stars", "desc"]],
      limit: 26,
    },
    {
      dataContractId: id(9),
      documentTypeName: "appRating",
      where: [["contractId", "==", id(2)]],
      orderBy: [["stars", "asc"]],
      limit: 26,
    },
    {
      dataContractId: id(9),
      documentTypeName: "appRating",
      where: [
        ["contractId", "==", id(2)],
        ["stars", "==", 3],
      ],
      orderBy: [["stars", "asc"]],
      limit: 26,
    },
    {
      dataContractId: id(9),
      documentTypeName: "appRating",
      where: [["contractId", "==", id(2)]],
      orderBy: [["$createdAt", "desc"]],
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
    documentTypeName: "appRating",
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
