import { describe, expect, it } from "vitest";
import {
  bytesToBase58,
  idToBytes,
  IdReadError,
  isBase58Id,
  readId,
} from "../src/dash/ids";
import { id } from "./helpers";
describe("Platform identifier normalization", () => {
  it("normalizes strings, handles, typed bytes, and JSON byte arrays", () => {
    const bytes = new Uint8Array(32).fill(255);
    const encoded = bytesToBase58(bytes);
    for (const value of [
      encoded,
      bytes,
      [...bytes],
      { toString: () => encoded },
    ])
      expect(readId(value)).toBe(encoded);
    expect(idToBytes(encoded)).toEqual(bytes);
    expect(readId(new Uint8Array(32))).toBe("1".repeat(32));
    expect(readId(null)).toBeNull();
    expect(readId(undefined)).toBeNull();
  });
  it.each([-1, 0.5, NaN, Infinity, 256])(
    "rejects invalid bytes before Uint8Array coercion: %s",
    (bad) => {
      const bytes = Array(32).fill(0);
      bytes[3] = bad;
      expect(() => readId(bytes)).toThrow(IdReadError);
    },
  );
  it("rejects sparse arrays, malformed strings and handles", () => {
    for (const value of [
      new Array(32),
      new Uint8Array(31),
      new Uint8Array(33),
      "",
      "0".repeat(32),
      "1".repeat(31),
      "1".repeat(33),
      "z".repeat(44),
      {},
      42,
      { toString: () => "bad" },
      {
        toString: () => {
          throw new Error("bad");
        },
      },
    ])
      expect(() => readId(value)).toThrow(IdReadError);
  });
  it("validates decoded length, including leading zeros", () => {
    expect(isBase58Id(id(10))).toBe(true);
    expect(isBase58Id("1".repeat(33))).toBe(false);
    expect(isBase58Id(idToBytes(id(10)))).toBe(false);
  });
});
