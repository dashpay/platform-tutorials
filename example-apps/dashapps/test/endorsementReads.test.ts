import { expect, it, vi } from "vitest";
import {
  collapseByContract,
  endorsementFor,
  endorsementRecord,
  endorsementsFor,
  myEndorsements,
  officialFeed,
  officialListing,
} from "../src/dash/endorsementReads";
import type { RegistryEntry } from "../src/dash/registryReads";
import { id, sdk } from "./helpers";

function endorsementDocument(n: number, contract: number, publisher: number) {
  return {
    id: id(n),
    ownerId: id(1),
    revision: 1n,
    createdAt: BigInt(n),
    properties: { contractId: id(contract), publisherId: id(publisher) },
  };
}

function entryDocument(n: number, owner: number, contract: number) {
  return {
    id: id(n),
    ownerId: id(owner),
    revision: 1n,
    properties: {
      contractId: id(contract),
      name: `App ${n}`,
      tagline: "Tagline",
      category: "other",
    },
  };
}

function entry(n: number, owner: number, contract: number): RegistryEntry {
  return {
    id: id(n),
    ownerId: id(owner),
    contractId: id(contract),
    name: `App ${n}`,
    tagline: "Tagline",
    category: "other",
    tags: [],
    revision: 1n,
  };
}

it("parses endorsements and rejects a malformed publisher", () => {
  expect(endorsementRecord(endorsementDocument(5, 2, 6))).toEqual({
    id: id(5),
    ownerId: id(1),
    contractId: id(2),
    publisherId: id(6),
    createdAt: 5n,
    updatedAt: undefined,
    revision: 1n,
  });
  expect(() =>
    endorsementRecord({
      ...endorsementDocument(5, 2, 6),
      properties: { contractId: id(2), publisherId: "bad" },
    }),
  ).toThrow();
});

it("resolves the official entry through the endorsement's publisher", async () => {
  const client = sdk();
  vi.mocked(client.documents.query)
    .mockResolvedValueOnce([endorsementDocument(5, 2, 6)])
    .mockResolvedValueOnce([entryDocument(7, 6, 2)]);
  const listing = await officialListing(client, id(9), id(2));
  expect(listing?.endorsement.publisherId).toBe(id(6));
  expect(listing?.entry?.id).toBe(id(7));
  expect(vi.mocked(client.documents.query).mock.calls.map(([a]) => a)).toEqual([
    {
      dataContractId: id(9),
      documentTypeName: "appEndorsement",
      where: [["contractId", "==", id(2)]],
      orderBy: [["contractId", "asc"]],
      limit: 1,
    },
    {
      dataContractId: id(9),
      documentTypeName: "appMetadata",
      where: [
        ["$ownerId", "==", id(6)],
        ["contractId", "==", id(2)],
      ],
      orderBy: [
        ["$ownerId", "asc"],
        ["contractId", "asc"],
      ],
      limit: 1,
    },
  ]);
});

it("reports a dangling endorsement and no endorsement distinctly", async () => {
  const client = sdk();
  // The publisher withdrew their entry after being endorsed.
  vi.mocked(client.documents.query)
    .mockResolvedValueOnce([endorsementDocument(5, 2, 6)])
    .mockResolvedValueOnce([]);
  expect(await officialListing(client, id(9), id(2))).toMatchObject({
    endorsement: { publisherId: id(6) },
    entry: null,
  });
  vi.mocked(client.documents.query).mockResolvedValueOnce([]);
  expect(await officialListing(client, id(9), id(2))).toBeNull();
  expect(client.documents.query).toHaveBeenCalledTimes(3);
  vi.mocked(client.documents.query).mockResolvedValueOnce([]);
  expect(await endorsementFor(client, id(9), id(2))).toBeNull();
});

it("batches endorsement lookups for a page with `in`, 100 at a time", async () => {
  const client = sdk();
  vi.mocked(client.documents.query).mockResolvedValueOnce([
    endorsementDocument(50, 4, 6),
    endorsementDocument(51, 3, 1),
  ]);
  const contracts = Array.from({ length: 101 }, (_, index) => id(index + 1));
  const endorsements = await endorsementsFor(client, id(9), [
    ...contracts,
    id(3),
  ]);
  expect([...endorsements.keys()]).toEqual([id(4), id(3)]);
  expect(endorsements.get(id(4))?.publisherId).toBe(id(6));
  expect(client.documents.query).toHaveBeenNthCalledWith(1, {
    dataContractId: id(9),
    documentTypeName: "appEndorsement",
    where: [["contractId", "in", contracts.slice(0, 100)]],
    orderBy: [["contractId", "asc"]],
    limit: 100,
  });
  expect(client.documents.query).toHaveBeenNthCalledWith(2, {
    dataContractId: id(9),
    documentTypeName: "appEndorsement",
    where: [["contractId", "in", [id(101)]]],
    orderBy: [["contractId", "asc"]],
    limit: 1,
  });
});

it("feeds official entries newest endorsement first, keeping dangling ones", async () => {
  const client = sdk();
  vi.mocked(client.documents.query).mockImplementation(async (args) => {
    if (args.documentTypeName === "appEndorsement")
      return [
        endorsementDocument(30, 2, 6),
        endorsementDocument(12, 3, 7),
        endorsementDocument(41, 4, 8),
      ];
    const [, [, , contractId]] = args.where as [
      unknown,
      [string, string, string],
    ];
    return contractId === id(3) ? [] : [entryDocument(60, 6, 2)];
  });
  const feed = await officialFeed(client, id(9), id(99), 2);
  expect(
    feed.listings.map(({ endorsement, entry }) => [
      endorsement.contractId,
      entry?.id ?? null,
    ]),
  ).toEqual([
    [id(2), id(60)],
    [id(3), null],
  ]);
  expect(feed.cursor).toBe(id(12));
  expect(client.documents.query).toHaveBeenCalledWith({
    dataContractId: id(9),
    documentTypeName: "appEndorsement",
    where: [],
    orderBy: [["$createdAt", "desc"]],
    limit: 3,
    startAfter: id(99),
  });
});

it("pages an owner's endorsements by last update", async () => {
  const client = sdk();
  vi.mocked(client.documents.query).mockResolvedValue([
    endorsementDocument(8, 2, 1),
  ]);
  const page = await myEndorsements(client, id(9), id(1));
  expect(page).toMatchObject({
    endorsements: [{ id: id(8) }],
    cursor: undefined,
  });
  expect(client.documents.query).toHaveBeenCalledWith({
    dataContractId: id(9),
    documentTypeName: "appEndorsement",
    where: [["$ownerId", "==", id(1)]],
    orderBy: [["$updatedAt", "desc"]],
    limit: 26,
  });
});

it("collapses a page to one row per contract, preferring the official entry", () => {
  const rows = [
    entry(10, 5, 2),
    entry(11, 6, 3),
    entry(12, 7, 2),
    entry(13, 8, 3),
  ];
  const official = new Map([[id(2), id(7)]]);
  expect(collapseByContract(rows, official).map((row) => row.id)).toEqual([
    id(12),
    id(11),
  ]);
  // Without an endorsement the first row the server returned wins.
  expect(collapseByContract(rows, new Map()).map((row) => row.id)).toEqual([
    id(10),
    id(11),
  ]);
});
