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
});
