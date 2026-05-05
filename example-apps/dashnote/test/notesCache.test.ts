// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearCachedNotes,
  loadCachedNotes,
  notesEqualByRevision,
  saveCachedNotes,
} from "../src/lib/notesCache";
import type { NoteRecord } from "../src/dash/queries";

const KEY = (
  id: string,
  contractId: string = CONTRACT,
  network: string = "testnet",
) => `dashnote.notes.${id}.${contractId}.${network}`;

const ID = "identity-abc";
const CONTRACT = "contract-1";

function note(
  overrides: Partial<NoteRecord> & Pick<NoteRecord, "id" | "revision">,
): NoteRecord {
  return {
    ownerId: ID,
    title: null,
    message: "",
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("notesCache load/save/clear", () => {
  it("returns null on a cold cache", () => {
    expect(loadCachedNotes(ID, CONTRACT, "testnet")).toBeNull();
  });

  it("round-trips a saved list", () => {
    const notes = [note({ id: "a", revision: 1, message: "alpha" })];
    saveCachedNotes(ID, CONTRACT, "testnet", notes);
    const loaded = loadCachedNotes(ID, CONTRACT, "testnet");
    expect(loaded).toEqual(notes);
  });

  it("clears every contract+network slot for an identity in one call", () => {
    // Seed three slots under the same identity across different contract/
    // network combinations, plus an unrelated identity that must survive.
    saveCachedNotes(ID, CONTRACT, "testnet", [note({ id: "a", revision: 1 })]);
    saveCachedNotes(ID, "contract-2", "testnet", [
      note({ id: "b", revision: 1 }),
    ]);
    saveCachedNotes(ID, CONTRACT, "mainnet", [note({ id: "c", revision: 1 })]);
    saveCachedNotes("other-identity", CONTRACT, "testnet", [
      note({ id: "d", revision: 1 }),
    ]);

    clearCachedNotes(ID);

    expect(loadCachedNotes(ID, CONTRACT, "testnet")).toBeNull();
    expect(loadCachedNotes(ID, "contract-2", "testnet")).toBeNull();
    expect(loadCachedNotes(ID, CONTRACT, "mainnet")).toBeNull();
    expect(localStorage.getItem(KEY(ID, CONTRACT))).toBeNull();
    expect(localStorage.getItem(KEY(ID, "contract-2"))).toBeNull();
    expect(localStorage.getItem(KEY(ID, CONTRACT, "mainnet"))).toBeNull();
    // Unrelated identity must not be swept.
    expect(
      loadCachedNotes("other-identity", CONTRACT, "testnet"),
    ).not.toBeNull();
  });

  it("isolates entries per contract (different contract gets its own slot)", () => {
    saveCachedNotes(ID, CONTRACT, "testnet", [note({ id: "a", revision: 1 })]);
    // A different contract has its own entry; the original contract's
    // cache stays intact.
    expect(loadCachedNotes(ID, "different-contract", "testnet")).toBeNull();
    expect(localStorage.getItem(KEY(ID, CONTRACT))).not.toBeNull();
  });

  it("isolates entries per network (different network gets its own slot)", () => {
    saveCachedNotes(ID, CONTRACT, "testnet", [note({ id: "a", revision: 1 })]);
    expect(loadCachedNotes(ID, CONTRACT, "mainnet")).toBeNull();
    // Original network's slot is untouched.
    expect(loadCachedNotes(ID, CONTRACT, "testnet")).not.toBeNull();
  });

  it("rejects hand-corrupted payloads where the embedded identityId disagrees with the key", () => {
    // Defense-in-depth: the storage key already encodes identityId, so the
    // only way to hit this branch is by hand-planting a payload whose
    // internal `identityId` field disagrees with the one in the key. We
    // still want to reject it rather than serve mismatched notes.
    localStorage.setItem(
      KEY(ID),
      JSON.stringify({
        version: 1,
        identityId: "other-identity",
        contractId: CONTRACT,
        network: "testnet",
        cachedAt: Date.now(),
        notes: [],
      }),
    );
    expect(loadCachedNotes(ID, CONTRACT, "testnet")).toBeNull();
  });

  it("invalidates and removes the entry when the schema version is unknown", () => {
    localStorage.setItem(
      KEY(ID),
      JSON.stringify({
        version: 999,
        identityId: ID,
        contractId: CONTRACT,
        network: "testnet",
        cachedAt: Date.now(),
        notes: [],
      }),
    );
    expect(loadCachedNotes(ID, CONTRACT, "testnet")).toBeNull();
    expect(localStorage.getItem(KEY(ID))).toBeNull();
  });

  it("invalidates and removes the entry when the JSON payload is malformed", () => {
    localStorage.setItem(KEY(ID), "{not valid json");
    expect(loadCachedNotes(ID, CONTRACT, "testnet")).toBeNull();
    expect(localStorage.getItem(KEY(ID))).toBeNull();
  });

  it("returns null without throwing when localStorage.getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(loadCachedNotes(ID, CONTRACT, "testnet")).toBeNull();
  });

  it("swallows errors when saving fails (e.g. quota exceeded)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    expect(() =>
      saveCachedNotes(ID, CONTRACT, "testnet", [
        note({ id: "a", revision: 1 }),
      ]),
    ).not.toThrow();
  });

  it("swallows errors when clearing fails", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => clearCachedNotes(ID)).not.toThrow();
  });

  it("ignores empty identity or contract IDs on save/load/clear", () => {
    expect(() =>
      saveCachedNotes("", CONTRACT, "testnet", [
        note({ id: "a", revision: 1 }),
      ]),
    ).not.toThrow();
    expect(() =>
      saveCachedNotes(ID, "", "testnet", [note({ id: "a", revision: 1 })]),
    ).not.toThrow();
    expect(loadCachedNotes("", CONTRACT, "testnet")).toBeNull();
    expect(loadCachedNotes(ID, "", "testnet")).toBeNull();
    expect(() => clearCachedNotes("")).not.toThrow();
  });

  it("isolates entries per identity", () => {
    const notesA = [note({ id: "a", revision: 1, message: "for-A" })];
    const notesB = [note({ id: "b", revision: 1, message: "for-B" })];
    saveCachedNotes("identity-A", CONTRACT, "testnet", notesA);
    saveCachedNotes("identity-B", CONTRACT, "testnet", notesB);
    expect(loadCachedNotes("identity-A", CONTRACT, "testnet")).toEqual(notesA);
    expect(loadCachedNotes("identity-B", CONTRACT, "testnet")).toEqual(notesB);
    clearCachedNotes("identity-A");
    expect(loadCachedNotes("identity-A", CONTRACT, "testnet")).toBeNull();
    expect(loadCachedNotes("identity-B", CONTRACT, "testnet")).toEqual(notesB);
  });
});

describe("notesEqualByRevision", () => {
  it("treats two empty arrays as equal", () => {
    expect(notesEqualByRevision([], [])).toBe(true);
  });

  it("returns false when lengths differ", () => {
    expect(notesEqualByRevision([note({ id: "a", revision: 1 })], [])).toBe(
      false,
    );
  });

  it("returns true when every (id, revision) pair matches in order", () => {
    const a = [note({ id: "1", revision: 5 }), note({ id: "2", revision: 3 })];
    const b = [
      note({ id: "1", revision: 5, message: "different body but same rev" }),
      note({ id: "2", revision: 3 }),
    ];
    expect(notesEqualByRevision(a, b)).toBe(true);
  });

  it("returns false when any revision changes", () => {
    const a = [note({ id: "1", revision: 5 })];
    const b = [note({ id: "1", revision: 6 })];
    expect(notesEqualByRevision(a, b)).toBe(false);
  });

  it("returns false when ordering or IDs change", () => {
    const a = [note({ id: "1", revision: 1 }), note({ id: "2", revision: 1 })];
    const b = [note({ id: "2", revision: 1 }), note({ id: "1", revision: 1 })];
    expect(notesEqualByRevision(a, b)).toBe(false);
  });
});
