import { expect, it, vi } from "vitest";
import {
  allProposals,
  entriesByCategory,
  exactRegistryEntry,
  myEntries,
  recentEntries,
  registryEntry,
  searchEntriesByName,
} from "../src/dash/registryReads";
import { id, sdk } from "./helpers";

function document(n: number, owner = 1, target = 2) {
  return {
    id: id(n),
    ownerId: id(owner),
    revision: 1n,
    createdAt: BigInt(n),
    properties: {
      contractId: id(target),
      name: `App ${n}`,
      tagline: `App ${n} tagline`,
      category: "developer-tools",
      tags: "test",
      appUrl: "https://example.com/app",
      iconUrl: "https://example.com/icon.png",
    },
  };
}

it("parses strict registry documents", () => {
  expect(registryEntry(document(3))).toMatchObject({
    id: id(3),
    ownerId: id(1),
    contractId: id(2),
    name: "App 3",
    revision: 1n,
  });
  expect(() =>
    registryEntry({
      ...document(3),
      properties: {
        contractId: "bad",
        name: "Bad",
        tagline: "Bad",
        category: "other",
        tags: "",
        appUrl: "https://example.com",
        iconUrl: "https://example.com/icon.png",
      },
    }),
  ).toThrow();
});

it("uses exact, recent and name index shapes with document-ID cursors", async () => {
  const client = sdk();
  vi.mocked(client.documents.query)
    .mockResolvedValueOnce([document(3)])
    .mockResolvedValueOnce(
      Array.from({ length: 50 }, (_, index) => document(index + 10)),
    )
    .mockResolvedValueOnce(
      Array.from({ length: 25 }, (_, index) => document(index + 100)),
    );
  expect(await exactRegistryEntry(client, id(9), id(1), id(2))).toMatchObject({
    id: id(3),
  });
  const recent = await recentEntries(client, id(9), id(8));
  expect(recent.cursor).toBe(id(59));
  const names = await searchEntriesByName(client, id(9), "App", id(7));
  expect(names.cursor).toBe(id(124));
  expect(client.documents.query).toHaveBeenNthCalledWith(1, {
    dataContractId: id(9),
    documentTypeName: "appMetadata",
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
  expect(client.documents.query).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      orderBy: [["$createdAt", "desc"]],
      limit: 50,
      startAfter: id(8),
    }),
  );
  expect(client.documents.query).toHaveBeenNthCalledWith(
    3,
    expect.objectContaining({
      where: [["name", "startsWith", "App"]],
      orderBy: [["name", "asc"]],
      limit: 25,
      startAfter: id(7),
    }),
  );
});

it("skips malformed registry documents without losing valid entries or pagination", async () => {
  const client = sdk();
  const page = Array.from({ length: 50 }, (_, index) => document(index + 10));
  page[24] = {
    ...document(34),
    properties: { ...document(34).properties, category: "untrusted" },
  };
  page[49] = {
    ...document(59),
    properties: { ...document(59).properties, tags: ["not-a-string"] },
  } as unknown as ReturnType<typeof document>;
  vi.mocked(client.documents.query).mockResolvedValue(page);

  const recent = await recentEntries(client, id(9));

  expect(recent.entries).toHaveLength(48);
  expect(recent.entries.map((entry) => entry.id)).not.toContain(id(34));
  expect(recent.cursor).toBe(id(59));
});

it("pages a category newest first with limit + 1 and a document-ID cursor", async () => {
  const client = sdk();
  // An order no local sort produces; the page must come back as given.
  vi.mocked(client.documents.query)
    .mockResolvedValueOnce([document(40), document(52), document(17)])
    .mockResolvedValueOnce([document(23)]);
  const first = await entriesByCategory(
    client,
    id(9),
    "developer-tools",
    undefined,
    2,
  );
  expect(first.entries.map((entry) => entry.id)).toEqual([id(40), id(52)]);
  expect(first.cursor).toBe(id(52));
  const second = await entriesByCategory(
    client,
    id(9),
    "developer-tools",
    first.cursor,
    2,
  );
  expect(second.entries.map((entry) => entry.id)).toEqual([id(23)]);
  expect(second.cursor).toBeUndefined();
  expect(vi.mocked(client.documents.query).mock.calls.map(([a]) => a)).toEqual([
    {
      dataContractId: id(9),
      documentTypeName: "appMetadata",
      where: [["category", "==", "developer-tools"]],
      orderBy: [["$createdAt", "desc"]],
      limit: 3,
    },
    {
      dataContractId: id(9),
      documentTypeName: "appMetadata",
      where: [["category", "==", "developer-tools"]],
      orderBy: [["$createdAt", "desc"]],
      limit: 3,
      startAfter: id(52),
    },
  ]);
});

it("defaults category pages to 25 and rejects a stuck cursor", async () => {
  const client = sdk();
  vi.mocked(client.documents.query).mockResolvedValueOnce(
    Array.from({ length: 26 }, (_, index) => document(index + 10)),
  );
  const page = await entriesByCategory(client, id(9), "games");
  expect(page.entries).toHaveLength(25);
  expect(page.cursor).toBe(id(34));
  expect(client.documents.query).toHaveBeenCalledWith(
    expect.objectContaining({ limit: 26 }),
  );
  vi.mocked(client.documents.query).mockResolvedValueOnce([
    document(30),
    document(31),
  ]);
  await expect(
    entriesByCategory(client, id(9), "games", id(30), 1),
  ).rejects.toThrow("did not advance");
});

it("reads proposals newest first from the server and keeps its order", async () => {
  const client = sdk();
  vi.mocked(client.documents.query).mockResolvedValueOnce([
    document(7),
    document(30),
    document(12),
  ]);
  const proposals = await allProposals(client, id(9), id(2));
  expect(proposals.map((entry) => entry.id)).toEqual([id(7), id(30), id(12)]);
  expect(client.documents.query).toHaveBeenCalledWith({
    dataContractId: id(9),
    documentTypeName: "appMetadata",
    where: [["contractId", "==", id(2)]],
    orderBy: [["$createdAt", "desc"]],
    limit: 100,
  });
});

it("scans proposals and personal submissions to completion", async () => {
  const client = sdk();
  const first = Array.from({ length: 100 }, (_, index) => document(index + 10));
  vi.mocked(client.documents.query)
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce([document(200)])
    .mockResolvedValueOnce([document(300)]);
  const proposals = await allProposals(client, id(9), id(2));
  expect(proposals).toHaveLength(101);
  expect(client.documents.query).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ startAfter: id(109) }),
  );
  expect(await myEntries(client, id(9), id(1))).toHaveLength(1);
  expect(client.documents.query).toHaveBeenNthCalledWith(
    3,
    expect.objectContaining({
      where: [["$ownerId", "==", id(1)]],
      orderBy: [
        ["$ownerId", "asc"],
        ["contractId", "asc"],
      ],
      limit: 100,
    }),
  );
});
