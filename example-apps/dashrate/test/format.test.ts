import { afterEach, describe, expect, it, vi } from "vitest";
import { formatAverage, formatDate, shortId } from "../src/lib/format";

describe("formatAverage", () => {
  it("renders a one-decimal average", () => {
    expect(formatAverage(4)).toBe("4.0");
    expect(formatAverage(4.25)).toBe("4.3"); // toFixed rounds half up
    expect(formatAverage(3.333333)).toBe("3.3");
  });

  it("renders a dash for null or non-finite values", () => {
    expect(formatAverage(null)).toBe("-");
    expect(formatAverage(Number.NaN)).toBe("-");
    expect(formatAverage(Number.POSITIVE_INFINITY)).toBe("-");
  });
});

describe("shortId", () => {
  it("returns short ids unchanged at or below the 14-char threshold", () => {
    expect(shortId("")).toBe("");
    expect(shortId("abc")).toBe("abc");
    // exactly 14 chars — the boundary, still returned whole
    expect(shortId("12345678901234")).toBe("12345678901234");
  });

  it("truncates longer ids to 7 + ... + last 6", () => {
    // 15 chars — just over the threshold
    expect(shortId("123456789012345")).toBe("1234567...012345");
    expect(shortId("63LaKWuFq9p8x2y4z6wcDgLY")).toBe("63LaKWu...wcDgLY");
  });
});

describe("formatDate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("labels missing timestamps without formatting", () => {
    expect(formatDate(null)).toBe("Unknown time");
    expect(formatDate(0)).toBe("Unknown time");
  });

  it("formats a real timestamp via Intl with medium date / short time", () => {
    // formatDate hardcodes locale `undefined` + no timezone, so the rendered
    // string is environment-dependent. Stub Intl.DateTimeFormat to verify the
    // contract deterministically: the right options are passed, the Date is
    // built from the ms value, and the formatter's output is returned verbatim.
    const format = vi.fn().mockReturnValue("Nov 14, 2023, 10:13 PM");
    const ctor = vi
      .spyOn(Intl, "DateTimeFormat")
      .mockImplementation(function mockFormatter() {
        return { format } as unknown as Intl.DateTimeFormat;
      } as unknown as typeof Intl.DateTimeFormat);

    expect(formatDate(1_700_000_000_000)).toBe("Nov 14, 2023, 10:13 PM");
    expect(ctor).toHaveBeenCalledWith(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    expect(format).toHaveBeenCalledWith(new Date(1_700_000_000_000));
  });
});
