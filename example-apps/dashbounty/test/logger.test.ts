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

  it("formats a WasmSdkError-shaped object with name, message, code, and retriable", () => {
    // wasm-bindgen exposes fields as class getters, not own properties, so
    // the object under test uses getters to match that surface exactly.
    const wasmError = Object.create(null);
    Object.defineProperties(wasmError, {
      __wbg_ptr: { value: 42, enumerable: true },
      name: { get: () => "Protocol" },
      message: {
        get: () => "Insufficient identity balance 5000000 required 189793800",
      },
      code: { get: () => 14 },
      isRetriable: { get: () => true },
    });
    expect(errorMessage(wasmError)).toBe(
      "Protocol: Insufficient identity balance 5000000 required 189793800 (code=14, retriable)",
    );
  });

  it("omits the retriable tag when isRetriable is false", () => {
    const wasmError = Object.create(null);
    Object.defineProperties(wasmError, {
      __wbg_ptr: { value: 1, enumerable: true },
      name: { get: () => "InvalidArgument" },
      message: { get: () => "bad input" },
      code: { get: () => 25 },
      isRetriable: { get: () => false },
    });
    expect(errorMessage(wasmError)).toBe(
      "InvalidArgument: bad input (code=25)",
    );
  });

  it("falls back to bare message when name is missing", () => {
    const partial = Object.create(null);
    Object.defineProperties(partial, {
      __wbg_ptr: { value: 3, enumerable: true },
      message: { get: () => "half-shape wasm error" },
    });
    expect(errorMessage(partial)).toBe("half-shape wasm error");
  });

  it("never surfaces the raw __wbg_ptr placeholder", () => {
    // The regression this covers: an early errorMessage version fell
    // through to JSON.stringify on any non-Error object without an
    // enumerable `message`, which serialized wasm-bindgen objects as
    // `{"__wbg_ptr":N}` and hid the real failure reason from the UI.
    const wasmError = Object.create(null);
    Object.defineProperties(wasmError, {
      __wbg_ptr: { value: 99, enumerable: true },
      name: { get: () => "NotFound" },
      message: { get: () => "identity not found" },
      code: { get: () => 27 },
      isRetriable: { get: () => false },
    });
    const formatted = errorMessage(wasmError);
    expect(formatted).not.toContain("__wbg_ptr");
    expect(formatted).toContain("identity not found");
  });

  it("swallows getters that throw", () => {
    const flaky = Object.create(null);
    Object.defineProperties(flaky, {
      __wbg_ptr: { value: 7, enumerable: true },
      name: {
        get: () => {
          throw new Error("name getter blew up");
        },
      },
      message: { get: () => "the real message" },
      code: {
        get: () => {
          throw new Error("code getter blew up");
        },
      },
      isRetriable: { get: () => false },
    });
    expect(errorMessage(flaky)).toBe("the real message");
  });

  it("stringifies unknown non-object values", () => {
    expect(errorMessage(42)).toBe("42");
    expect(errorMessage(null)).toBe("null");
    expect(errorMessage(undefined)).toBe("undefined");
  });
});
