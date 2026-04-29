import { describe, expect, it } from "vitest";

import { errorMessage } from "../src/dash/logger";

describe("errorMessage", () => {
  it("returns the message of an Error instance", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns subclass Error messages", () => {
    expect(errorMessage(new TypeError("nope"))).toBe("nope");
  });

  it("passes raw strings through unchanged", () => {
    expect(errorMessage("plain")).toBe("plain");
    expect(errorMessage("")).toBe("");
  });

  it("uses obj.message when present and a string", () => {
    expect(errorMessage({ message: "wrapped" })).toBe("wrapped");
  });

  it("falls back to JSON.stringify for objects without a string message", () => {
    expect(errorMessage({ code: 42, details: "bad" })).toBe(
      JSON.stringify({ code: 42, details: "bad" }),
    );
  });

  it("falls back to String(err) when JSON.stringify throws (circular)", () => {
    const circular: Record<string, unknown> = { foo: 1 };
    circular.self = circular;
    expect(errorMessage(circular)).toBe(String(circular));
  });

  it("ignores a non-string message field", () => {
    // No string-message branch hit; falls into JSON.stringify.
    expect(errorMessage({ message: 42 })).toBe(JSON.stringify({ message: 42 }));
  });

  it("stringifies primitive non-string values", () => {
    expect(errorMessage(42)).toBe("42");
    expect(errorMessage(true)).toBe("true");
    expect(errorMessage(null)).toBe("null");
    expect(errorMessage(undefined)).toBe("undefined");
  });
});
