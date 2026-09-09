import { expect, it, vi } from "vitest";
import {
  listRatings,
  ownRating,
  ratingRecord,
  ratingSummary,
  starsKeyHex,
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

it("encodes grouped-count keys as the sign-flipped single byte", () => {
  expect(starsKeyHex(1)).toBe("81");
  expect(starsKeyHex(5)).toBe("85");
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
  vi.mocked(client.documents.count).mockResolvedValue(
    new Map([
      ["83", 2n],
      ["85", 8n],
    ]),
  );
  const summary = await ratingSummary(client, id(9), id(2));
  expect(summary.distribution).toEqual({ 1: 0n, 2: 0n, 3: 2n, 4: 0n, 5: 8n });
  expect(summary.count).toBe(10n);
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
  vi.mocked(client.documents.count).mockResolvedValue(new Map([["85", -1n]]));
  await expect(ratingSummary(client, id(9), id(2))).rejects.toThrow(
    "Malformed count response.",
  );
  vi.mocked(client.documents.count).mockResolvedValue(
    [] as unknown as Map<string, bigint>,
  );
  await expect(ratingSummary(client, id(9), id(2))).rejects.toThrow(
    "Malformed count response.",
  );
});

it("orders by the serving index's trailing property for each sort and filter", async () => {
  const client = sdk();
  vi.mocked(client.documents.query).mockResolvedValue([document(3)]);
  await listRatings(client, id(9), id(2));
  await listRatings(client, id(9), id(2), { sort: "highest" });
  await listRatings(client, id(9), id(2), { sort: "lowest" });
  await listRatings(client, id(9), id(2), { sort: "highest", stars: 3 });
  const calls = vi.mocked(client.documents.query).mock.calls.map(([args]) => ({
    where: args.where,
    orderBy: args.orderBy,
  }));
  expect(calls).toEqual([
    { where: [["contractId", "==", id(2)]], orderBy: [["$createdAt", "desc"]] },
    { where: [["contractId", "==", id(2)]], orderBy: [["stars", "desc"]] },
    { where: [["contractId", "==", id(2)]], orderBy: [["stars", "asc"]] },
    {
      where: [
        ["contractId", "==", id(2)],
        ["stars", "==", 3],
      ],
      orderBy: [["stars", "asc"]],
    },
  ]);
  expect(vi.mocked(client.documents.query).mock.calls[0][0]).toMatchObject({
    dataContractId: id(9),
    documentTypeName: "appRating",
    limit: 25,
  });
});

it("pages by document ID, skips malformed rows and detects stuck cursors", async () => {
  const client = sdk();
  const page = Array.from({ length: 25 }, (_, index) => document(index + 10));
  page[3] = {
    ...document(13),
    properties: { ...document(13).properties, stars: 9 },
  };
  const second = Array.from({ length: 25 }, (_, index) => document(index + 40));
  vi.mocked(client.documents.query)
    .mockResolvedValueOnce(page)
    .mockResolvedValueOnce(second)
    .mockResolvedValueOnce(page)
    .mockResolvedValueOnce([document(3)]);
  const first = await listRatings(client, id(9), id(2));
  expect(first.ratings).toHaveLength(24);
  expect(first.cursor).toBe(id(34));
  const next = await listRatings(client, id(9), id(2), {
    cursor: first.cursor,
  });
  expect(next.cursor).toBe(id(64));
  expect(client.documents.query).toHaveBeenLastCalledWith(
    expect.objectContaining({ startAfter: id(34) }),
  );
  await expect(
    listRatings(client, id(9), id(2), { cursor: id(34) }),
  ).rejects.toThrow("cursor did not advance");
  expect((await listRatings(client, id(9), id(2))).cursor).toBeUndefined();
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
