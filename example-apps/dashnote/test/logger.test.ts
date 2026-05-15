import { describe, expect, it } from "vitest";

import { errorMessage, normalizeLogOptions } from "../src/lib/logger";

describe("normalizeLogOptions", () => {
  it("returns an empty options object when no argument is given", () => {
    expect(normalizeLogOptions()).toEqual({});
    expect(normalizeLogOptions(undefined)).toEqual({});
  });

  it("wraps a positional LogLevel string into the object form", () => {
    expect(normalizeLogOptions("success")).toEqual({ level: "success" });
    expect(normalizeLogOptions("error")).toEqual({ level: "error" });
    expect(normalizeLogOptions("info")).toEqual({ level: "info" });
  });

  it("passes through an options object unchanged", () => {
    const opts = { level: "error" as const, detail: "boom" };
    expect(normalizeLogOptions(opts)).toBe(opts);
  });
});

describe("errorMessage", () => {
  it("returns the message of an Error instance", () => {
    expect(errorMessage(new Error("kaboom"))).toBe("kaboom");
  });

  it("returns string errors as-is", () => {
    expect(errorMessage("just a string")).toBe("just a string");
  });

  it("extracts message from a plain object that has one", () => {
    expect(errorMessage({ message: "object message" })).toBe("object message");
  });

  it("JSON-stringifies plain objects without a message", () => {
    expect(errorMessage({ code: 42 })).toBe('{"code":42}');
  });

  it("falls back to String() for non-serializable inputs", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(errorMessage(circular)).toBe(String(circular));
  });

  it("handles null and undefined safely", () => {
    expect(errorMessage(null)).toBe("null");
    expect(errorMessage(undefined)).toBe("undefined");
  });
});
