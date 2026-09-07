import { expect, it } from "vitest";
import { classifyApp, pickCanonical } from "../src/dash/canonical";
import { contract, id } from "./helpers";
const owner = { id: id(10), ownerId: id(1), name: "Owner entry" };
const community = { id: id(11), ownerId: id(2), name: "Proposal" };
const base = {
  resolution: {
    status: "found" as const,
    ownerId: id(1),
    contract: contract(),
  },
  canonicalLookup: { status: "success" as const, document: null },
  proposals: [community],
  proposalsComplete: false,
};
it("requires a normalized owner string and matches mixed proposals", () => {
  expect(pickCanonical(id(1), [community, owner])).toEqual(owner);
  expect(pickCanonical(id(1), [community])).toBeNull();
  expect(() => pickCanonical("", [])).toThrow();
  expect(() =>
    pickCanonical({ toString: () => id(1) } as unknown as string, []),
  ).toThrow();
  expect(() => pickCanonical(id(1), [owner, owner])).toThrow();
});
it("keeps an independent canonical lookup outside a partial proposal page", () => {
  expect(
    classifyApp({
      ...base,
      canonicalLookup: { status: "success", document: owner },
    }),
  ).toMatchObject({
    status: "canonical",
    canonical: owner,
    community: [community],
  });
  expect(
    classifyApp({
      ...base,
      proposals: [owner, community],
      canonicalLookup: { status: "success", document: owner },
    }),
  ).toMatchObject({ community: [community] });
});
it("preserves pending and error states instead of inventing absence", () => {
  expect(
    classifyApp({ ...base, canonicalLookup: { status: "pending" } }).status,
  ).toBe("pending");
  expect(
    classifyApp({
      ...base,
      canonicalLookup: { status: "error", error: new Error("offline") },
    }).status,
  ).toBe("error");
  expect(
    classifyApp({
      ...base,
      resolution: { status: "error", error: new Error("offline") },
    }).status,
  ).toBe("error");
  expect(
    classifyApp({ ...base, resolution: { status: "missing" } }),
  ).toMatchObject({ status: "contract-missing", community: [community] });
});
it("requires complete empty reads to declare no entries", () => {
  expect(classifyApp({ ...base, proposals: [] }).status).toBe("no-owner-entry");
  expect(
    classifyApp({ ...base, proposals: [], proposalsComplete: true }).status,
  ).toBe("no-entries");
  expect(() =>
    classifyApp({
      ...base,
      canonicalLookup: { status: "success", document: community },
    }),
  ).toThrow();
});
