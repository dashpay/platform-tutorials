// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearRememberedIdentity,
  loadRememberedIdentity,
  saveRememberedIdentity,
} from "../src/lib/rememberedIdentity";

const KEY = "dashnote.lastIdentity";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rememberedIdentity storage", () => {
  it("returns null when nothing is stored", () => {
    expect(loadRememberedIdentity()).toBeNull();
  });

  it("persists an identity ID and reads it back", () => {
    saveRememberedIdentity({ id: "identity-abc" });
    expect(JSON.parse(localStorage.getItem(KEY) ?? "null")).toEqual({
      id: "identity-abc",
    });
    expect(loadRememberedIdentity()).toEqual({
      id: "identity-abc",
      name: null,
    });
  });

  it("persists an identity ID with its DPNS name", () => {
    saveRememberedIdentity({ id: "identity-abc", name: "alice" });
    expect(loadRememberedIdentity()).toEqual({
      id: "identity-abc",
      name: "alice",
    });
  });

  it("clears the stored identity", () => {
    localStorage.setItem(KEY, JSON.stringify({ id: "identity-abc" }));
    clearRememberedIdentity();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(loadRememberedIdentity()).toBeNull();
  });

  it("returns null when the stored value is not valid JSON", () => {
    localStorage.setItem(KEY, "not-json");
    expect(loadRememberedIdentity()).toBeNull();
  });

  it("returns null when the stored record is missing an id", () => {
    localStorage.setItem(KEY, JSON.stringify({ name: "alice" }));
    expect(loadRememberedIdentity()).toBeNull();
  });

  it("returns null when localStorage access throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(loadRememberedIdentity()).toBeNull();
  });

  it("swallows errors when saving fails", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    expect(() => saveRememberedIdentity({ id: "anything" })).not.toThrow();
  });

  it("swallows errors when clearing fails", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => clearRememberedIdentity()).not.toThrow();
  });
});
