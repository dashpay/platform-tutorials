// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearCachedNotes,
  loadCachedNotes,
  notesEqualByRevision,
  saveCachedNotes,
} from "../src/dash/notesCache";
import type { NoteRecord } from "../src/dash/queries";

const KEY = (id: string) => `dashnote.notes.${id}`;

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

  it("clears entries by identity", () => {
    saveCachedNotes(ID, CONTRACT, "testnet", [note({ id: "a", revision: 1 })]);
    clearCachedNotes(ID);
    expect(localStorage.getItem(KEY(ID))).toBeNull();
    expect(loadCachedNotes(ID, CONTRACT, "testnet")).toBeNull();
  });

  it("invalidates when the contract changes (and removes the stale entry)", () => {
    saveCachedNotes(ID, CONTRACT, "testnet", [note({ id: "a", revision: 1 })]);
    expect(loadCachedNotes(ID, "different-contract", "testnet")).toBeNull();
    expect(localStorage.getItem(KEY(ID))).toBeNull();
  });

  it("invalidates when the network changes", () => {
    saveCachedNotes(ID, CONTRACT, "testnet", [note({ id: "a", revision: 1 })]);
    expect(loadCachedNotes(ID, CONTRACT, "mainnet")).toBeNull();
  });

  it("invalidates when the cached identity ID does not match the requested one", () => {
    // Manually plant a payload under one key but with a different identityId
    // inside — represents a corrupt or migrated cache.
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
