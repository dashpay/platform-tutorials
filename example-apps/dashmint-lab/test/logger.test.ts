import { describe, expect, it } from "vitest";

import { errorMessage } from "../src/dash/logger";

describe("errorMessage", () => {
  it("reads .message from Error instances", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns string values as-is", () => {
    expect(errorMessage("already a string")).toBe("already a string");
  });

  it("reads .message from plain objects (Evo SDK throws these)", () => {
    expect(errorMessage({ message: "wasm failed", code: 7 })).toBe(
      "wasm failed",
    );
  });

  it("JSON-stringifies objects without a string message", () => {
    expect(errorMessage({ code: 7, detail: "nope" })).toBe(
      '{"code":7,"detail":"nope"}',
    );
  });

  it("falls back to String() when JSON.stringify throws (circular refs)", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(errorMessage(circular)).toBe("[object Object]");
  });

  it("handles primitives that are neither Error nor string", () => {
    expect(errorMessage(42)).toBe("42");
    expect(errorMessage(null)).toBe("null");
  });
});
