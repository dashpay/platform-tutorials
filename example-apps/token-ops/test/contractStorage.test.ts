// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_CONTRACT_ID,
  clearStoredContractId,
  loadStoredContractId,
  saveContractId,
} from "../src/dash/contractStorage";

const STORAGE_KEY = "token-ops.contractId";

/** Node 26 leaves `globalThis.localStorage` undefined under jsdom. */
function installMemoryStorage() {
  const store = new Map<string, string>();
  const storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  } satisfies Storage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  return storage;
}

describe("contractStorage localStorage helpers", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = installMemoryStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the stored contract id when present", () => {
    storage.setItem(STORAGE_KEY, "stored-contract");
    expect(loadStoredContractId()).toBe("stored-contract");
  });

  it("falls back to the default when nothing is stored", () => {
    expect(loadStoredContractId()).toBe(DEFAULT_CONTRACT_ID);
  });

  it("saves and clears the stored contract id", () => {
    saveContractId("published-contract");
    expect(storage.getItem(STORAGE_KEY)).toBe("published-contract");
    clearStoredContractId();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(loadStoredContractId()).toBe(DEFAULT_CONTRACT_ID);
  });

  it("returns the default when load fails instead of throwing", () => {
    vi.spyOn(storage, "getItem").mockImplementation(() => {
      throw new DOMException("Denied", "SecurityError");
    });
    expect(loadStoredContractId()).toBe(DEFAULT_CONTRACT_ID);
  });

  it("swallows save failures so callers keep the in-memory id", () => {
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new DOMException("Denied", "SecurityError");
    });
    expect(() => saveContractId("published-contract")).not.toThrow();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("swallows clear failures so callers can still restore the fallback", () => {
    storage.setItem(STORAGE_KEY, "stored-contract");
    vi.spyOn(storage, "removeItem").mockImplementation(() => {
      throw new DOMException("Denied", "SecurityError");
    });
    expect(() => clearStoredContractId()).not.toThrow();
  });
});
