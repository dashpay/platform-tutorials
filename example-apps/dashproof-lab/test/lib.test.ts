import { describe, expect, it } from "vitest";

import { EXAMPLE_FILE_FIXTURES } from "../src/data/exampleFiles";
import { suggestChainId } from "../src/lib/chainId";
import {
  bytesToBase64,
  bytesToDocumentArray,
  bytesToHex,
  coerceBytes,
} from "../src/lib/hash";
import {
  formatBytes,
  formatCompactTimestamp,
  formatHashBlocks,
  formatRelativeTime,
  formatTimespan,
  formatTimestamp,
  shortMimeLabel,
  truncateId,
} from "../src/lib/format";

describe("lib/hash", () => {
  it("bytesToHex produces zero-padded lowercase hex", () => {
    expect(bytesToHex(Uint8Array.from([0, 1, 15, 16, 255]))).toBe("00010f10ff");
    expect(bytesToHex(new Uint8Array(0))).toBe("");
  });

  it("bytesToBase64 round-trips through coerceBytes", () => {
    const bytes = Uint8Array.from([1, 2, 3, 4, 5]);
    const base64 = bytesToBase64(bytes);
    expect(base64).toBe("AQIDBAU=");
    expect(coerceBytes(base64)).toEqual(bytes);
  });

  it("bytesToDocumentArray returns a plain number array", () => {
    const result = bytesToDocumentArray(Uint8Array.from([7, 8, 9]));
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([7, 8, 9]);
  });

  describe("coerceBytes", () => {
    it("returns the same Uint8Array unchanged", () => {
      const input = Uint8Array.from([1, 2, 3]);
      expect(coerceBytes(input)).toBe(input);
    });

    it("wraps an ArrayBuffer", () => {
      const buffer = Uint8Array.from([4, 5, 6]).buffer;
      expect(coerceBytes(buffer)).toEqual(Uint8Array.from([4, 5, 6]));
    });

    it("copies an ArrayBufferView so the source is detached from the result", () => {
      const source = Uint8Array.from([10, 20, 30, 40]);
      const result = coerceBytes(source);
      // The function clones the underlying buffer when the input is a view
      // other than Uint8Array, but Uint8Array is returned as-is by the
      // earlier branch — pass an Int8Array view instead to hit ArrayBuffer.isView.
      expect(result).toBe(source);

      const intView = new Int8Array(source.buffer);
      const cloned = coerceBytes(intView);
      cloned[0] = 0;
      expect(source[0]).toBe(10);
    });

    it("honors byteOffset/byteLength for typed-array subviews", () => {
      // A Uint8Array subview from offset 2, length 3 should produce only
      // the [30, 40, 50] bytes — not the full backing buffer.
      const buffer = Uint8Array.from([10, 20, 30, 40, 50, 60]).buffer;
      const subview = new Int8Array(buffer, 2, 3);
      expect(coerceBytes(subview)).toEqual(Uint8Array.from([30, 40, 50]));
    });

    it("converts a plain number array", () => {
      expect(coerceBytes([1, 2, 3])).toEqual(Uint8Array.from([1, 2, 3]));
    });

    it("decodes a hex string when even-length and hex-only", () => {
      expect(coerceBytes("0a0b0c")).toEqual(Uint8Array.from([10, 11, 12]));
    });

    it("prefers hex over base64 when input is even-length and hex-only", () => {
      // "abcd" is valid base64 ([0x69, 0xb7, 0x1d]) and valid hex ([0xab, 0xcd]).
      // The hex branch must win because even-length hex-only takes precedence.
      expect(coerceBytes("abcd")).toEqual(Uint8Array.from([0xab, 0xcd]));
    });

    it("decodes base64 when not pure hex", () => {
      expect(coerceBytes("AQIDBAU=")).toEqual(Uint8Array.from([1, 2, 3, 4, 5]));
    });

    it("unwraps a legacy { data: number[] } object", () => {
      expect(coerceBytes({ data: [1, 2, 3] })).toEqual(
        Uint8Array.from([1, 2, 3]),
      );
    });

    it("throws for unsupported values", () => {
      expect(() => coerceBytes(undefined)).toThrow(/Unsupported byte-array/);
      expect(() => coerceBytes(null)).toThrow(/Unsupported byte-array/);
      expect(() => coerceBytes(42 as unknown)).toThrow(
        /Unsupported byte-array/,
      );
    });
  });
});

describe("lib/chainId", () => {
  it("matches a fixture by hash even when filename differs", () => {
    const fixture = EXAMPLE_FILE_FIXTURES[0];
    expect(
      suggestChainId({ filename: "renamed.txt", hashHex: fixture.sha256Hex }),
    ).toBe(fixture.chainId);
  });

  it("matches a fixture by filename when hash is absent", () => {
    const fixture = EXAMPLE_FILE_FIXTURES[0];
    expect(suggestChainId({ filename: fixture.filename })).toBe(
      fixture.chainId,
    );
  });

  it("slugifies arbitrary filenames", () => {
    expect(suggestChainId({ filename: "Quarterly Audit Report.pdf" })).toBe(
      "quarterly-audit-report",
    );
    expect(suggestChainId({ filename: "Release Notes 2026.md" })).toBe(
      "release-notes-2026",
    );
    expect(suggestChainId({ filename: "She's #1 _ winner.txt" })).toBe(
      "shes-1-winner",
    );
  });

  it("falls back to 'proof' for empty or untypable names", () => {
    expect(suggestChainId({ filename: "" })).toBe("proof");
    expect(suggestChainId({ filename: "   " })).toBe("proof");
    expect(suggestChainId({ filename: "***.???" })).toBe("proof");
  });
});

describe("lib/format", () => {
  describe("truncateId", () => {
    it("returns an em-dash for nullish ids", () => {
      expect(truncateId(null)).toBe("—");
      expect(truncateId(undefined)).toBe("—");
      expect(truncateId("")).toBe("—");
    });

    it("returns the id unchanged when short enough", () => {
      expect(truncateId("abcd", 4)).toBe("abcd");
    });

    it("truncates with an ellipsis preserving head and tail", () => {
      const id = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      expect(truncateId(id, 4)).toBe("ABCD…STUVWXYZ");
    });

    it("never returns a string longer than the input when head ≠ default", () => {
      // Regression: the old short-circuit used `head * 2` while the slice
      // used a fixed 8-char tail, so truncateId("ABCDEFGHI", 4) emitted
      // "ABCD…BCDEFGHI" — 13 chars from a 9-char input. The threshold and
      // the slice must use the same tail size.
      const id = "ABCDEFGHI";
      const result = truncateId(id, 4);
      expect(result.length).toBeLessThanOrEqual(id.length);
    });

    it("respects an explicit tail parameter", () => {
      const id = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      expect(truncateId(id, 4, 4)).toBe("ABCD…WXYZ");
    });
  });

  describe("formatBytes", () => {
    it("returns em-dash for null/undefined/NaN", () => {
      expect(formatBytes(null)).toBe("—");
      expect(formatBytes(undefined)).toBe("—");
      expect(formatBytes(Number.NaN)).toBe("—");
    });

    it("renders bytes under 1KB as 'B'", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(512)).toBe("512 B");
    });

    it("scales up through KB / MB / GB / TB", () => {
      expect(formatBytes(1024)).toBe("1.0 KB");
      expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
      expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
      expect(formatBytes(1024 ** 4)).toBe("1.0 TB");
    });

    it("drops decimals once the value is >= 10", () => {
      expect(formatBytes(50 * 1024)).toBe("50 KB");
    });
  });

  describe("formatTimestamp / formatCompactTimestamp", () => {
    it("returns 'Pending' for zero / null / undefined", () => {
      expect(formatTimestamp(null)).toBe("Pending");
      expect(formatTimestamp(undefined)).toBe("Pending");
      expect(formatTimestamp(0)).toBe("Pending");
      expect(formatCompactTimestamp(null)).toBe("Pending");
      expect(formatCompactTimestamp(0)).toBe("Pending");
    });

    it("emits a non-empty localized string for real timestamps", () => {
      const timestamp = Date.UTC(2026, 3, 1, 12, 0);
      const value = formatTimestamp(timestamp);
      expect(value).not.toBe("Pending");
      expect(value).toBe(new Date(timestamp).toLocaleString());

      const compact = formatCompactTimestamp(timestamp);
      expect(compact).toBe(
        new Date(timestamp).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      );
      expect(compact).toMatch(/2026/);
    });
  });

  describe("formatRelativeTime", () => {
    const NOW = Date.UTC(2026, 3, 29, 12, 0, 0);

    it("returns 'Pending' for falsy timestamps", () => {
      expect(formatRelativeTime(null, NOW)).toBe("Pending");
      expect(formatRelativeTime(0, NOW)).toBe("Pending");
    });

    it("renders past times in the past tense", () => {
      const tenMinutesAgo = NOW - 10 * 60_000;
      const value = formatRelativeTime(tenMinutesAgo, NOW);
      expect(value).toMatch(/ago/);
    });

    it("renders future times with 'in'", () => {
      const inThreeHours = NOW + 3 * 60 * 60_000;
      const value = formatRelativeTime(inThreeHours, NOW);
      expect(value).toMatch(/in /);
    });
  });

  describe("formatTimespan", () => {
    it("renders sub-day spans in hours", () => {
      expect(formatTimespan(60 * 60 * 1000)).toBe("1h");
      expect(formatTimespan(5 * 60 * 60 * 1000)).toBe("5h");
    });

    it("renders multi-day spans in days", () => {
      expect(formatTimespan(3 * 24 * 60 * 60 * 1000)).toBe("3d");
    });

    it("rolls into months past 60 days", () => {
      expect(formatTimespan(120 * 24 * 60 * 60 * 1000)).toBe("4mo");
    });
  });

  describe("shortMimeLabel", () => {
    it("returns 'FILE' when mime is missing", () => {
      expect(shortMimeLabel(null)).toBe("FILE");
      expect(shortMimeLabel(undefined)).toBe("FILE");
      expect(shortMimeLabel("")).toBe("FILE");
    });

    it("uses the canonical map for known MIME types", () => {
      expect(shortMimeLabel("text/csv")).toBe("CSV");
      expect(shortMimeLabel("application/pdf")).toBe("PDF");
      expect(
        shortMimeLabel(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
      ).toBe("XLSX");
    });

    it("falls back to a 6-char uppercased subtype for unknown MIME types", () => {
      expect(shortMimeLabel("application/markdown")).toBe("MARKDO");
      expect(shortMimeLabel("text/yaml")).toBe("YAML");
    });
  });

  describe("formatHashBlocks", () => {
    it("returns em-dash for empty input", () => {
      expect(formatHashBlocks(null)).toBe("—");
      expect(formatHashBlocks("")).toBe("—");
    });

    it("groups characters into blocks separated by spaces and lines", () => {
      const hex = "0123456789abcdef0123456789abcdef";
      const formatted = formatHashBlocks(hex, 4, 4);
      // 4-char blocks, 4 per line: "0123 4567 89ab cdef\n0123 4567 89ab cdef"
      expect(formatted).toBe("0123 4567 89ab cdef\n0123 4567 89ab cdef");
    });
  });
});
