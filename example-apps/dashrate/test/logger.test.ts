import { describe, expect, it } from "vitest";
import { errorMessage } from "../src/lib/logger";

describe("errorMessage", () => {
  it("extracts standard errors and plain strings", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage("plain")).toBe("plain");
  });

  it("calls function-style SDK messages", () => {
    expect(
      errorMessage({
        message: () => "wasm says no",
        __wbg_ptr: 123,
      }),
    ).toBe("wasm says no");
  });

  it("leaves pointer-only wasm objects visible as extraction failures", () => {
    expect(errorMessage({ __wbg_ptr: 4639936 })).toBe('{"__wbg_ptr":4639936}');
  });

  it("extracts base64 CBOR SDK message strings", () => {
    expect(
      errorMessage(
        "oWdtZXNzYWdleKxzdG9yYWdlOiBkcml2ZTogbm90IHN1cHBvcnRlZCBlcnJvcjogTm90Q291bnRlZE9yU3VtbWVkLXdyYXBwaW5nIGlzIG9ubHkgc3VwcG9ydGVkIGZvciB0aGUgc2l4IHN1bS1iZWFyaW5nIHRyZWUgdmFyaWFudHMg4oCUIHNlZSBgZm9yX2tub3duX3BhdGhfa2V5X2VtcHR5X25vdF9zdW1tZWRfdHJlZWAu",
      ),
    ).toContain("NotCountedOrSummed-wrapping");
  });

  it("returns a base64-shaped string as-is when it is not CBOR", () => {
    // Passes the structural gate (base64 charset, length >= 8) but the first
    // byte isn't a 1-entry CBOR map, so decode bails and the raw string wins.
    expect(errorMessage("YWJjZGVmZ2g")).toBe("YWJjZGVmZ2g");
  });

  it("reads a plain object message string", () => {
    expect(errorMessage({ message: "plain object boom" })).toBe(
      "plain object boom",
    );
  });

  it("falls through a function-style message that throws", () => {
    // message() throwing must not crash extraction; falls to the name/kind
    // shape below it.
    expect(
      errorMessage({
        message: () => {
          throw new Error("nope");
        },
        name: "ProtocolError",
        kind: "Overflow",
        code: 42,
      }),
    ).toBe("ProtocolError: Overflow: code 42");
  });

  it("composes name/kind/code for structured WASM errors", () => {
    expect(errorMessage({ name: "StateError", kind: "NotFound" })).toBe(
      "StateError: NotFound",
    );
    expect(errorMessage({ name: "StateError" })).toBe("StateError");
  });

  it("returns 'Unknown error' for undefined (not JSON-serializable)", () => {
    // JSON.stringify(undefined) is undefined, so the final fallback wins.
    expect(errorMessage(undefined)).toBe("Unknown error");
  });

  it("falls back to the JSON form for null", () => {
    // null is not an object, so the object branch is skipped and
    // JSON.stringify(null) — "null" — is returned.
    expect(errorMessage(null)).toBe("null");
  });

  it("returns 'Unknown error' for an empty object", () => {
    // No message/name, String() is "[object Object]", and JSON.stringify is
    // "{}" — both rejected, so the final fallback wins.
    expect(errorMessage({})).toBe("Unknown error");
  });
});
