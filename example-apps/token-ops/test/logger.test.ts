import { describe, expect, it } from "vitest";
import { errorMessage } from "../src/dash/logger";

describe("errorMessage", () => {
  it("returns Error.message for real Error instances", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns strings as-is", () => {
    expect(errorMessage("nope")).toBe("nope");
  });

  it("returns .message on plain error-shaped objects", () => {
    expect(errorMessage({ message: "just a message" })).toBe("just a message");
  });

  it("reads .message off a wasm-bindgen error (a getter, not an own field)", () => {
    // wasm-bindgen exposes fields as class getters rather than own
    // properties, so the object under test uses a getter to match that
    // surface. `typeof obj.message === "string"` still triggers it, so the
    // real failure reason surfaces instead of the `{"__wbg_ptr":N}` that a
    // JSON.stringify fallback would produce.
    const wasmError = Object.create(null);
    Object.defineProperties(wasmError, {
      __wbg_ptr: { value: 42, enumerable: true },
      message: {
        get: () => "Insufficient identity balance 5000000 required 189793800",
      },
    });
    const formatted = errorMessage(wasmError);
    expect(formatted).toBe(
      "Insufficient identity balance 5000000 required 189793800",
    );
    expect(formatted).not.toContain("__wbg_ptr");
  });

  it("stringifies unknown non-object values", () => {
    expect(errorMessage(42)).toBe("42");
    expect(errorMessage(null)).toBe("null");
    expect(errorMessage(undefined)).toBe("undefined");
  });
});
