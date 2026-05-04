// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearRememberedIdentityId,
  loadRememberedIdentityId,
  saveRememberedIdentityId,
} from "../src/lib/rememberedIdentity";

const KEY = "dashnote.lastIdentityId";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rememberedIdentity storage", () => {
  it("returns null when nothing is stored", () => {
    expect(loadRememberedIdentityId()).toBeNull();
  });

  it("persists an identity ID and reads it back", () => {
    saveRememberedIdentityId("identity-abc");
    expect(localStorage.getItem(KEY)).toBe("identity-abc");
    expect(loadRememberedIdentityId()).toBe("identity-abc");
  });

  it("clears the stored identity ID", () => {
    localStorage.setItem(KEY, "identity-abc");
    clearRememberedIdentityId();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(loadRememberedIdentityId()).toBeNull();
  });

  it("returns null when localStorage access throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(loadRememberedIdentityId()).toBeNull();
  });

  it("swallows errors when saving fails", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    expect(() => saveRememberedIdentityId("anything")).not.toThrow();
  });

  it("swallows errors when clearing fails", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => clearRememberedIdentityId()).not.toThrow();
  });
});
