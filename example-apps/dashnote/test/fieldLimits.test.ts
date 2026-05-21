import { describe, it, expect } from "vitest";

import {
  FIELD_BYTE_LIMIT,
  byteLength,
  isOversize,
} from "../src/lib/fieldLimits";

describe("FIELD_BYTE_LIMIT", () => {
  it("matches the network's max_field_value_size (5120 B / 5 KiB)", () => {
    expect(FIELD_BYTE_LIMIT).toBe(5120);
  });
});

describe("byteLength", () => {
  it("returns 0 for an empty string", () => {
    expect(byteLength("")).toBe(0);
  });

  it("counts ASCII as 1 byte per character", () => {
    expect(byteLength("hello")).toBe(5);
    expect(byteLength("a".repeat(5120))).toBe(5120);
  });

  it("counts 2-byte UTF-8 sequences (Latin-1 supplement) as 2 bytes each", () => {
    // "é" is U+00E9, 2 bytes in UTF-8 (0xC3 0xA9)
    expect(byteLength("é")).toBe(2);
    expect(byteLength("café")).toBe(5);
  });

  it("counts 3-byte UTF-8 sequences (CJK) as 3 bytes each", () => {
    // "漢" is U+6F22, 3 bytes in UTF-8
    expect(byteLength("漢")).toBe(3);
    expect(byteLength("漢字")).toBe(6);
  });

  it("counts 4-byte UTF-8 sequences (emoji outside the BMP) as 4 bytes each", () => {
    // "🚀" is U+1F680, 4 bytes in UTF-8 — one code point, two UTF-16 units.
    // string.length === 2 but UTF-8 byteLength === 4.
    expect("🚀".length).toBe(2);
    expect(byteLength("🚀")).toBe(4);
  });

  it("counts ZWJ-joined emoji sequences correctly", () => {
    // "👨‍👩‍👧" is three 4-byte emoji joined by two ZWJ (U+200D, 3 bytes each)
    // → 4 + 3 + 4 + 3 + 4 = 18 bytes, even though it renders as one glyph.
    const family = "👨‍👩‍👧";
    expect(byteLength(family)).toBe(18);
  });
});

describe("isOversize", () => {
  it("returns false at exactly the byte limit (5120 ASCII chars)", () => {
    const exact = "a".repeat(FIELD_BYTE_LIMIT);
    expect(byteLength(exact)).toBe(FIELD_BYTE_LIMIT);
    expect(isOversize(exact)).toBe(false);
  });

  it("returns false one byte under the limit", () => {
    expect(isOversize("a".repeat(FIELD_BYTE_LIMIT - 1))).toBe(false);
  });

  it("returns true one byte over the limit", () => {
    expect(isOversize("a".repeat(FIELD_BYTE_LIMIT + 1))).toBe(true);
  });

  it("treats 2-byte chars as 2 bytes against the limit", () => {
    // 2560 × "é" = 5120 bytes (at limit, not oversize)
    expect(isOversize("é".repeat(2560))).toBe(false);
    // 2561 × "é" = 5122 bytes (over)
    expect(isOversize("é".repeat(2561))).toBe(true);
  });

  it("treats CJK as 3 bytes — string.length stays well below the limit while bytes blow past it", () => {
    // 1707 × "漢" = 5121 bytes (over). string.length is only 1707,
    // so a char-based maxLength of 5120 would have let this through.
    const cjk = "漢".repeat(1707);
    expect(cjk.length).toBeLessThan(FIELD_BYTE_LIMIT);
    expect(byteLength(cjk)).toBe(5121);
    expect(isOversize(cjk)).toBe(true);
  });

  it("treats 4-byte emoji as 4 bytes — string.length stays under the limit while bytes exceed it", () => {
    // 1281 × "🚀" = 5124 bytes (over). string.length === 2562,
    // still under a notional 5120-char cap.
    const rockets = "🚀".repeat(1281);
    expect(rockets.length).toBeLessThan(FIELD_BYTE_LIMIT);
    expect(byteLength(rockets)).toBe(5124);
    expect(isOversize(rockets)).toBe(true);
  });
});
