import { expect, it, vi } from "vitest";
import {
  allProposals,
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
